#include "config.h"
#include "logger.h"
#include <fstream>
#include <nlohmann/json.hpp>

bool Config::load(const std::string& filepath, AgentConfig& out) {
    std::ifstream f(filepath);
    if (!f.is_open()) {
        LOG_ERROR("Не удалось открыть config.json: " + filepath);
        return false;
    }

    try {
        nlohmann::json j;
        f >> j;

        out.server_url     = j.value("server_url",     "http://localhost:3000");
        out.agent_uid      = j.value("agent_uid",      "unknown-agent");
        out.platform       = j.value("platform",       "linux");
        out.hostname       = j.value("hostname",       "unknown-host");
        out.version        = j.value("version",        "1.0.0");
        out.watch_dir      = j.value("watch_dir",      "/tmp/cardio");
        out.poll_interval  = j.value("poll_interval",  10);
        out.log_file       = j.value("log_file",       "agent.log");

        LOG_INFO("Конфиг загружен: " + filepath);
        return true;
    } catch (const std::exception& e) {
        LOG_ERROR("Ошибка парсинга config.json: " + std::string(e.what()));
        return false;
    }
}