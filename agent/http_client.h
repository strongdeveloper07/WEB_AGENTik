#pragma once
#include <string>
#include <map>

struct HttpResponse {
    long        status_code;
    std::string body;
    bool        success;
};

class HttpClient {
public:
    explicit HttpClient(const std::string& base_url);

    void setToken(const std::string& token);

    HttpResponse post(const std::string& endpoint,
                      const std::string& json_body);

    HttpResponse uploadFile(const std::string& endpoint,
                            const std::string& filepath,
                            const std::string& patient_id);

    HttpResponse get(const std::string& endpoint);

private:
    std::string base_url_;
    std::string token_;
};