#!/bin/bash

# Colors for test output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

DIST_DIR="../dist"

# Test counter
PASS=0
FAIL=0

function test_case() {
	local name=$1
	local cmd=$2
	local expected_output=$3
	local should_succeed=${4:-true}

	echo -n "Testing $name... "

	# Run the command and capture both stdout and stderr
	local output
	if [[ $should_succeed == "true" ]]; then
		output=$($cmd 2>&1)
		local status=$?
		if [[ $status -eq 0 && $output == *"$expected_output"* ]]; then
			echo -e "${GREEN}PASS${NC}"
			((PASS++))
			return 0
		fi
	else
		output=$($cmd 2>&1) || true
		if [[ $output == *"$expected_output"* ]]; then
			echo -e "${GREEN}PASS${NC}"
			((PASS++))
			return 0
		fi
	fi

	echo -e "${RED}FAIL${NC}"
	echo "  Expected output to contain: '$expected_output'"
	echo "  Got: '$output'"
	((FAIL++))
	return 0 # Don't fail the whole test suite on one failure
}

echo "Running distribute.sh tests..."
echo "----------------------------"

# Test command validation
test_case "no command" \
	"./distribute.sh" \
	"error: command not provided" \
	false

test_case "invalid command" \
	"./distribute.sh invalid_cmd" \
	"error: invalid command" \
	false

# Test getbinpath
test_case "getbinpath no arch" \
	"./distribute.sh getbinpath" \
	"error: runner architecture not provided" \
	false

test_case "getbinpath invalid arch" \
	"./distribute.sh getbinpath INVALID" \
	"error: invalid runner architecture: INVALID" \
	false

# Test push and binary creation
test_case "push command" \
	"./distribute.sh push" \
	"All builds completed!" \
	true

# Test binary existence
for arch in "X86:386" "X64:amd64" "ARM:arm" "ARM64:arm64"; do
	runner_arch=${arch%:*}
	go_arch=${arch#*:}
	test_case "binary exists for $runner_arch" \
		"test -f ${DIST_DIR}/cache-apt-pkgs-linux-$go_arch" \
		"" \
		true
done

# Test getbinpath for each architecture
for arch in "X86:386" "X64:amd64" "ARM:arm" "ARM64:arm64"; do
	runner_arch=${arch%:*}
	go_arch=${arch#*:}
	test_case "getbinpath for $runner_arch" \
		"./distribute.sh getbinpath $runner_arch" \
		"${DIST_DIR}/cache-apt-pkgs-linux-$go_arch" \
		true
done

# Test cleanup and rebuild
test_case "cleanup" \
	"rm -rf ${DIST_DIR}" \
	"" \
	true

test_case "getbinpath after cleanup" \
	"./distribute.sh getbinpath X64" \
	"error: binary not found" \
	false

test_case "rebuild after cleanup" \
	"./distribute.sh push" \
	"All builds completed!" \
	true

test_case "getbinpath after rebuild" \
	"./distribute.sh getbinpath X64" \
	"${DIST_DIR}/cache-apt-pkgs-linux-amd64" \
	true

# Print test summary
echo -e "\nTest Summary"
echo "------------"
echo -e "Tests passed: ${GREEN}$PASS${NC}"
echo -e "Tests failed: ${RED}$FAIL${NC}"

# Exit with failure if any tests failed
[[ $FAIL -eq 0 ]] || exit 1
