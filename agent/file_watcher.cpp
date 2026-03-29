#include "file_watcher.h"
#include "logger.h"
#include <filesystem>
#include <algorithm>

namespace fs = std::filesystem;

FileWatcher::FileWatcher(const std::string& watch_dir) : watch_dir_(watch_dir) {
    // Запоминаем файлы которые уже были до старта агента
    if (!fs::exists(watch_dir_)) {
        fs::create_directories(watch_dir_);
        LOG_INFO("Создана папка слежения: " + watch_dir_);
    }
    for (const auto& entry : fs::directory_iterator(watch_dir_)) {
        if (entry.is_regular_file()) {
            seen_files_.insert(entry.path().filename().string());
        }
    }
    LOG_INFO("FileWatcher инициализирован. Папка: " + watch_dir_ +
             ", уже существующих файлов: " + std::to_string(seen_files_.size()));
}

void FileWatcher::setCallback(FileCallback cb) {
    callback_ = cb;
}

bool FileWatcher::isAllowed(const std::string& filename) {
    static const std::set<std::string> allowed = {".ecg", ".csv", ".pdf", ".txt", ".xml"};
    size_t dot = filename.rfind('.');
    if (dot == std::string::npos) return false;
    std::string ext = filename.substr(dot);
    std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
    return allowed.count(ext) > 0;
}

void FileWatcher::scan() {
    if (!fs::exists(watch_dir_)) return;

    for (const auto& entry : fs::directory_iterator(watch_dir_)) {
        if (!entry.is_regular_file()) continue;

        std::string filename = entry.path().filename().string();
        if (!isAllowed(filename)) continue;

        if (seen_files_.find(filename) == seen_files_.end()) {
            seen_files_.insert(filename);
            LOG_INFO("Новый файл обнаружен: " + filename);
            if (callback_) {
                callback_(entry.path().string());
            }
        }
    }
}