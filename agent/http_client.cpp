#include "http_client.h"
#include "logger.h"
#include <curl/curl.h>
#include <stdexcept>

static size_t writeCallback(char* ptr, size_t size, size_t nmemb, std::string* data) {
    data->append(ptr, size * nmemb);
    return size * nmemb;
}

HttpClient::HttpClient(const std::string& base_url) : base_url_(base_url) {}

void HttpClient::setToken(const std::string& token) {
    token_ = token;
}

HttpResponse HttpClient::post(const std::string& endpoint, const std::string& json_body) {
    HttpResponse res{0, "", false};
    CURL* curl = curl_easy_init();
    if (!curl) { LOG_ERROR("curl_easy_init failed"); return res; }

    std::string url = base_url_ + endpoint;
    std::string response_body;

    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, "Content-Type: application/json");
    if (!token_.empty()) {
        std::string auth = "Authorization: Bearer " + token_;
        headers = curl_slist_append(headers, auth.c_str());
    }

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_body.c_str());
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, writeCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response_body);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);

    CURLcode code = curl_easy_perform(curl);
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &res.status_code);
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);

    if (code != CURLE_OK) {
        LOG_ERROR("HTTP POST ошибка: " + std::string(curl_easy_strerror(code)));
        return res;
    }

    res.body = response_body;
    res.success = (res.status_code >= 200 && res.status_code < 300);
    return res;
}

HttpResponse HttpClient::uploadFile(const std::string& endpoint,
                                     const std::string& filepath,
                                     const std::string& patient_id) {
    HttpResponse res{0, "", false};
    CURL* curl = curl_easy_init();
    if (!curl) { LOG_ERROR("curl_easy_init failed"); return res; }

    std::string url = base_url_ + endpoint;
    std::string response_body;

    curl_mime* form = curl_mime_init(curl);

    curl_mimepart* part = curl_mime_addpart(form);
    curl_mime_name(part, "file");
    curl_mime_filedata(part, filepath.c_str());

    curl_mimepart* part2 = curl_mime_addpart(form);
    curl_mime_name(part2, "patient_id");
    curl_mime_data(part2, patient_id.c_str(), CURL_ZERO_TERMINATED);

    struct curl_slist* headers = nullptr;
    if (!token_.empty()) {
        std::string auth = "Authorization: Bearer " + token_;
        headers = curl_slist_append(headers, auth.c_str());
    }

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_MIMEPOST, form);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, writeCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response_body);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 30L);

    CURLcode code = curl_easy_perform(curl);
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &res.status_code);
    curl_mime_free(form);
    if (headers) curl_slist_free_all(headers);
    curl_easy_cleanup(curl);

    if (code != CURLE_OK) {
        LOG_ERROR("Ошибка загрузки файла: " + std::string(curl_easy_strerror(code)));
        return res;
    }

    res.body = response_body;
    res.success = (res.status_code >= 200 && res.status_code < 300);
    return res;
}

HttpResponse HttpClient::get(const std::string& endpoint) {
    HttpResponse res{0, "", false};
    CURL* curl = curl_easy_init();
    if (!curl) return res;

    std::string url = base_url_ + endpoint;
    std::string response_body;

    struct curl_slist* headers = nullptr;
    if (!token_.empty()) {
        std::string auth = "Authorization: Bearer " + token_;
        headers = curl_slist_append(headers, auth.c_str());
    }

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, writeCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response_body);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);

    CURLcode code = curl_easy_perform(curl);
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &res.status_code);
    if (headers) curl_slist_free_all(headers);
    curl_easy_cleanup(curl);

    if (code != CURLE_OK) {
        LOG_ERROR("HTTP GET ошибка: " + std::string(curl_easy_strerror(code)));
        return res;
    }

    res.body = response_body;
    res.success = (res.status_code >= 200 && res.status_code < 300);
    return res;
} 