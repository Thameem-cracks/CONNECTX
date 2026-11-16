cmake_minimum_required(VERSION 3.20)
project(ConnectX VERSION 1.0.0 LANGUAGES CXX)

# ── C++ standard ──────────────────────────────────────────────────────────────
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ── Build type default ────────────────────────────────────────────────────────
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

# ── Output directories ────────────────────────────────────────────────────────
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

# ── vcpkg integration (optional — set VCPKG_ROOT env var if used) ─────────────
if(DEFINED ENV{VCPKG_ROOT})
  set(CMAKE_TOOLCHAIN_FILE "$ENV{VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake"
      CACHE STRING "vcpkg toolchain" FORCE)
endif()

# ── Find required packages ────────────────────────────────────────────────────
find_package(Threads REQUIRED)

# Boost (Asio + Beast header-only + System component)
find_package(Boost 1.74 REQUIRED COMPONENTS system)

# libpqxx – PostgreSQL C++ client
find_package(libpqxx QUIET)
if(NOT libpqxx_FOUND)
  # Fallback: try pkg-config
  find_package(PkgConfig QUIET)
  if(PkgConfig_FOUND)
    pkg_check_modules(LIBPQXX IMPORTED_TARGET libpqxx)
  endif()
endif()

# nlohmann/json header-only library
find_package(nlohmann_json QUIET)
if(NOT nlohmann_json_FOUND)
  include(FetchContent)
  FetchContent_Declare(
    nlohmann_json
    URL https://github.com/nlohmann/json/releases/download/v3.11.3/json.tar.xz
    URL_HASH SHA256=d6c65aca6b1ed68e7a182f4757257b107ae403032760ed6ef121c9d55e81757d
  )
  FetchContent_MakeAvailable(nlohmann_json)
endif()

# ── OpenSSL (for JWT / TLS) ───────────────────────────────────────────────────
find_package(OpenSSL REQUIRED)

# ── Collect source files ──────────────────────────────────────────────────────
file(GLOB_RECURSE CONNECTX_SOURCES
  "src/*.cpp"
  "src/**/*.cpp"
)

# ── Main executable ───────────────────────────────────────────────────────────
add_executable(connectx ${CONNECTX_SOURCES})

target_include_directories(connectx PRIVATE
  ${CMAKE_SOURCE_DIR}/include
  ${CMAKE_SOURCE_DIR}/src
)

target_link_libraries(connectx PRIVATE
  Threads::Threads
  Boost::system
  OpenSSL::SSL
  OpenSSL::Crypto
)

# Link nlohmann_json
if(TARGET nlohmann_json::nlohmann_json)
  target_link_libraries(connectx PRIVATE nlohmann_json::nlohmann_json)
endif()

# Link libpqxx
if(libpqxx_FOUND)
  target_link_libraries(connectx PRIVATE libpqxx::pqxx)
elseif(LIBPQXX_FOUND)
  target_link_libraries(connectx PRIVATE PkgConfig::LIBPQXX)
endif()

# ── Compiler warnings ─────────────────────────────────────────────────────────
if(MSVC)
  target_compile_options(connectx PRIVATE /W4 /WX- /wd4100 /wd4505)
else()
  target_compile_options(connectx PRIVATE
    -Wall -Wextra -Wpedantic
    -Wno-unused-parameter
    -Wno-unused-function
  )
endif()

# ── Tests ─────────────────────────────────────────────────────────────────────
option(BUILD_TESTS "Build unit tests" OFF)
if(BUILD_TESTS)
  enable_testing()
  add_subdirectory(tests)
endif()

message(STATUS "ConnectX v${PROJECT_VERSION} configured")
message(STATUS "  Build type : ${CMAKE_BUILD_TYPE}")
message(STATUS "  C++ standard: ${CMAKE_CXX_STANDARD}")
