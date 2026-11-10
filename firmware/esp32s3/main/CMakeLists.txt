set(CVNSS_NATIVE_DIR "${CMAKE_CURRENT_LIST_DIR}/../../../native")
idf_component_register(
    SRCS "main.cpp" "${CVNSS_NATIVE_DIR}/src/cvnss_codec.cpp"
    INCLUDE_DIRS "." "${CVNSS_NATIVE_DIR}/include"
    REQUIRES esp_timer esp_driver_uart
)
