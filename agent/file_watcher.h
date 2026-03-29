#pragma once
#include <string>
#include <set>
#include <functional>

using FileCallback = std::function<void(const std::string& filepath)>;

class FileWatcher {
public:
    explicit FileWatcher(const std::string& watch_dir);
    void setCallback(FileCallback cb);
    void scan();

private:
    bool isAllowed(const std::string& filename);

    std::string   watch_dir_;
    std::set<std::string> seen_files_;
    FileCallback  callback_;
};