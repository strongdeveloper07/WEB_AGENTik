#include "logger.h"
#include <iostream>
#include <chrono>
#include <ctime>
#include <iomanip>
#include <sstream>

Logger& Logger::instance() {
    static Logger inst;
    return inst;
}

void Logger::init(const std::string& filepath) {
    file_.open(filepath, std::ios::app);
    if (!file_.is_open()) {
        std::cerr << "[Logger] Не удалось открыть файл лога: " << filepath << std::endl;
    }
}

std::string Logger::getTimestamp() {
    auto now = std::chrono::system_clock::now();
    std::time_t t = std::chrono::system_clock::to_time_t(now);
    std::tm tm = *std::localtime(&t);
    std::ostringstream oss;
    oss << std::put_time(&tm, "%Y-%m-%d %H:%M:%S");
    return oss.str();
}

void Logger::write(const std::string& level, const std::string& msg) {
    std::lock_guard<std::mutex> lock(mutex_);
    std::string line = "[" + getTimestamp() + "] [" + level + "] " + msg;
    std::cout << line << std::endl;
    if (file_.is_open()) {
        file_ << line << "\n";
        file_.flush();
    }
}

void Logger::info(const std::string& msg)  { write("INFO",  msg); }
void Logger::error(const std::string& msg) { write("ERROR", msg); }
void Logger::warn(const std::string& msg)  { write("WARN",  msg); }