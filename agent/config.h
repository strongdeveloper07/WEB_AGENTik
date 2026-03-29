#pragma once
#include <string>

struct AgentConfig {
    std::string server_url;
    std::string agent_uid;
    std::string platform;
    std::string hostname;
    std::string version;
    std::string watch_dir;
    int         poll_interval;
    std::string log_file;
};

class Config {
public:
    static bool load(const std::string& filepath, AgentConfig& out);
};