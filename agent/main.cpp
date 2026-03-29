#include <iostream>
#include <thread>
#include <chrono>
#include <csignal>
#include <nlohmann/json.hpp>

#include "config.h"
#include "logger.h"
#include "http_client.h"
#include "file_watcher.h"

static bool running = true;

void signalHandler(int) {
    LOG_INFO("Получен сигнал завершения. Останавливаем агент...");
    running = false;
}

std::string registerAgent(HttpClient& http, const AgentConfig& cfg) {
    nlohmann::json body = {
        {"uid",      cfg.agent_uid},
        {"platform", cfg.platform},
        {"hostname", cfg.hostname},
        {"version",  cfg.version}
    };

    LOG_INFO("Регистрация агента на сервере...");
    auto res = http.post("/api/v1/agents/register", body.dump());

    if (!res.success) {
        LOG_ERROR("Ошибка регистрации. HTTP " + std::to_string(res.status_code) + ": " + res.body);
        return "";
    }

    try {
        auto j = nlohmann::json::parse(res.body);
        std::string token = j.value("session_token", "");
        LOG_INFO("Агент успешно зарегистрирован. Токен получен.");
        return token;
    } catch (...) {
        LOG_ERROR("Ошибка парсинга ответа регистрации: " + res.body);
        return "";
    }
}

void uploadFile(HttpClient& http, const std::string& filepath, const std::string& agent_uid) {
    LOG_INFO("Загружаем файл на сервер: " + filepath);

    // patient_id = "0" означает что файл не привязан к конкретному пациенту
    // врач привяжет его вручную через веб-интерфейс
    auto res = http.uploadFile("/api/v1/agents/" + agent_uid + "/upload", filepath, "0");

    if (res.success) {
        LOG_INFO("Файл успешно загружен: " + filepath);
    } else {
        LOG_ERROR("Ошибка загрузки файла. HTTP " +
                  std::to_string(res.status_code) + ": " + res.body);
    }
}

int main(int argc, char* argv[]) {
    std::string config_path = "config.json";
    if (argc > 1) config_path = argv[1];

    // Инициализируем логгер до загрузки конфига
    Logger::instance().init("agent.log");
    LOG_INFO("=== Агент запущен ===");

    // Загружаем конфиг
    AgentConfig cfg;
    if (!Config::load(config_path, cfg)) {
        LOG_ERROR("Не удалось загрузить конфиг. Завершение.");
        return 1;
    }

    // Переинициализируем логгер с путём из конфига
    Logger::instance().init(cfg.log_file);

    // Обработчик сигналов (Ctrl+C)
    std::signal(SIGINT,  signalHandler);
    std::signal(SIGTERM, signalHandler);

    // HTTP клиент
    HttpClient http(cfg.server_url);

    // Регистрация с повторными попытками
    std::string token;
    int attempts = 0;
    while (running && token.empty() && attempts < 5) {
        token = registerAgent(http, cfg);
        if (token.empty()) {
            LOG_WARN("Повтор через 5 секунд... (попытка " + std::to_string(++attempts) + "/5)");
            std::this_thread::sleep_for(std::chrono::seconds(5));
        }
    }

    if (token.empty()) {
        LOG_ERROR("Не удалось зарегистрироваться на сервере. Завершение.");
        return 1;
    }

    http.setToken(token);

    // Инициализируем слежение за папкой
    FileWatcher watcher(cfg.watch_dir);
    watcher.setCallback([&http, &cfg](const std::string& filepath) {
        uploadFile(http, filepath, cfg.agent_uid);
    });

    LOG_INFO("Агент активен. Слежу за папкой: " + cfg.watch_dir);
    LOG_INFO("Интервал проверки: " + std::to_string(cfg.poll_interval) + " сек.");

    // Главный цикл
    while (running) {
        watcher.scan();
        std::this_thread::sleep_for(std::chrono::seconds(cfg.poll_interval));
    }

    LOG_INFO("=== Агент остановлен ===");
    return 0;
}