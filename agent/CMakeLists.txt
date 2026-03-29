cmake_minimum_required(VERSION 3.16)
project(CardioAgent)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(CURL REQUIRED)
find_package(nlohmann_json REQUIRED)

add_executable(cardio_agent
    main.cpp
    config.cpp
    logger.cpp
    http_client.cpp
    file_watcher.cpp
)

target_link_libraries(cardio_agent
    CURL::libcurl
    nlohmann_json::nlohmann_json
)