#pragma once
#include <string>
#include <fstream>
#include <mutex>

class Logger {
public:
    static Logger& instance();
    void init(const std::string& filepath);
    void info(const std::string& msg);
    void error(const std::string& msg);
    void warn(const std::string& msg);

private:
    Logger() = default;
    void write(const std::string& level, const std::string& msg);
    std::ofstream file_;
    std::mutex mutex_;
    std::string getTimestamp();
};

#define LOG_INFO(msg)  Logger::instance().info(msg)
#define LOG_ERROR(msg) Logger::instance().error(msg)
#define LOG_WARN(msg)  Logger::instance().warn(msg)