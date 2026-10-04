#include <windows.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.System.h>
#include <iostream>
#include <string>

#pragma comment(lib, "windowsapp.lib")

using namespace winrt;
using namespace Windows::Foundation;
using namespace Windows::System;

int main() {
    try {
        init_apartment(apartment_type::single_threaded);

        auto users = User::FindAllAsync().get();
        if (users.Size() == 0) {
            std::cout << "{\"available\":false,\"reason\":\"NoUserFound\"}" << std::endl;
            return 0;
        }

        User user = users.GetAt(0);

        std::string statusStr = "Unknown";
        try {
            auto status = user.GetAgeVerificationStatusAsync().get();
            switch (status) {
                case UserAgeVerificationStatus::Verified:
                    statusStr = "Verified";
                    break;
                case UserAgeVerificationStatus::TemporarilyUnavailable:
                    statusStr = "TemporarilyUnavailable";
                    break;
                case UserAgeVerificationStatus::NotVerified:
                    statusStr = "NotVerified";
                    break;
                default:
                    statusStr = "Unknown";
                    break;
            }
        } catch (...) {
            statusStr = "Unavailable";
        }

        int lower = 0;
        int upper = 999;
        bool hasRange = false;

        try {
            auto range = user.GetUserAgeRangeAsync().get();
            lower = range.LowerAge();
            upper = range.UpperAge();
            hasRange = true;
        } catch (...) {
            hasRange = false;
        }

        if (hasRange) {
            std::cout << "{\"available\":true,\"lower\":" << lower 
                      << ",\"upper\":" << upper 
                      << ",\"status\":\"" << statusStr << "\"}" << std::endl;
        } else {
            std::cout << "{\"available\":false,\"status\":\"" << statusStr << "\"}" << std::endl;
        }
    } catch (...) {
        std::cout << "{\"available\":false}" << std::endl;
    }

    return 0;
}
