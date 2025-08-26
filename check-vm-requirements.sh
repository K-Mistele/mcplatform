#!/bin/bash

# Replicated Embedded Cluster VM Requirements Checker
# Run this script on your Linux VM to verify it meets the requirements

echo "🔍 Checking Replicated Embedded Cluster VM Requirements..."
echo "================================================================"

PASS_COUNT=0
TOTAL_CHECKS=7
FAILED_CHECKS=()

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_passed() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASS_COUNT++))
}

check_failed() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    FAILED_CHECKS+=("$1")
}

check_warning() {
    echo -e "${YELLOW}⚠ WARNING${NC}: $1"
}

echo "1. Checking Operating System and Architecture..."
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    ARCH=$(uname -m)
    if [[ "$ARCH" == "x86_64" ]]; then
        check_passed "Linux x86-64 architecture detected"
    else
        check_failed "Architecture is $ARCH, but x86-64 is required"
    fi
else
    check_failed "Not running on Linux (detected: $OSTYPE)"
fi

echo ""
echo "2. Checking systemd..."
if command -v systemctl &> /dev/null && systemctl --version &> /dev/null; then
    check_passed "systemd is available"
else
    check_failed "systemd is not available or not working"
fi

echo ""
echo "3. Checking CPU cores..."
CPU_CORES=$(nproc)
if [[ $CPU_CORES -ge 2 ]]; then
    check_passed "CPU cores: $CPU_CORES (minimum 2 required)"
else
    check_failed "CPU cores: $CPU_CORES (minimum 2 required)"
fi

echo ""
echo "4. Checking memory..."
MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}')
if [[ $MEMORY_GB -ge 2 ]]; then
    check_passed "Memory: ${MEMORY_GB}GB (minimum 2GB required)"
else
    check_failed "Memory: ${MEMORY_GB}GB (minimum 2GB required)"
fi

echo ""
echo "5. Checking disk space for /var/lib/embedded-cluster..."
TARGET_DIR="/var/lib/embedded-cluster"
PARENT_DIR="/var/lib"

# Check if the target directory exists, if not check parent directory
if [[ -d "$TARGET_DIR" ]]; then
    AVAILABLE_SPACE=$(df -BG "$TARGET_DIR" | tail -1 | awk '{print $4}' | sed 's/G//')
    SPACE_LOCATION="$TARGET_DIR"
elif [[ -d "$PARENT_DIR" ]]; then
    AVAILABLE_SPACE=$(df -BG "$PARENT_DIR" | tail -1 | awk '{print $4}' | sed 's/G//')
    SPACE_LOCATION="$PARENT_DIR (parent of target directory)"
else
    AVAILABLE_SPACE=$(df -BG / | tail -1 | awk '{print $4}' | sed 's/G//')
    SPACE_LOCATION="/ (root filesystem)"
fi

if [[ $AVAILABLE_SPACE -ge 40 ]]; then
    check_passed "Available disk space: ${AVAILABLE_SPACE}GB in $SPACE_LOCATION (minimum 40GB required)"
else
    check_failed "Available disk space: ${AVAILABLE_SPACE}GB in $SPACE_LOCATION (minimum 40GB required)"
fi

echo ""
echo "6. Checking network connectivity..."
if curl -s --connect-timeout 10 https://replicated.app > /dev/null; then
    check_passed "Can reach replicated.app"
else
    check_failed "Cannot reach replicated.app (required for installation)"
fi

if curl -s --connect-timeout 10 https://proxy.replicated.com > /dev/null; then
    check_passed "Can reach proxy.replicated.com"
else
    check_failed "Cannot reach proxy.replicated.com (required for installation)"
fi

# Summary
echo ""
echo "================================================================"
echo "📊 SUMMARY"
echo "================================================================"

if [[ $PASS_COUNT -eq $TOTAL_CHECKS ]]; then
    echo -e "${GREEN}🎉 SUCCESS!${NC} Your VM meets all requirements for Replicated Embedded Cluster"
    echo ""
    echo "You're ready to proceed with the Embedded Cluster installation!"
elif [[ $PASS_COUNT -ge 4 ]] && [[ ${#FAILED_CHECKS[@]} -gt 0 ]]; then
    echo -e "${YELLOW}⚠️  MOSTLY READY${NC} - $PASS_COUNT/$TOTAL_CHECKS checks passed"
    echo ""
    echo "Failed checks that need attention:"
    for failed in "${FAILED_CHECKS[@]}"; do
        echo "  • $failed"
    done
    echo ""
    echo "Please address the failed requirements before proceeding."
else
    echo -e "${RED}❌ NOT READY${NC} - Only $PASS_COUNT/$TOTAL_CHECKS checks passed"
    echo ""
    if [[ ${#FAILED_CHECKS[@]} -gt 0 ]]; then
        echo "Failed checks that need attention:"
        for failed in "${FAILED_CHECKS[@]}"; do
            echo "  • $failed"
        done
        echo ""
    fi
    echo "Please address the failed requirements before proceeding."
fi

echo ""
echo "For more information about Embedded Cluster requirements, visit:"
echo "https://docs.replicated.com/enterprise/installing-embedded-requirements"