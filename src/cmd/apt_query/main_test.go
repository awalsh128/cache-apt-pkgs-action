package main

import (
	"flag"
	"testing"

	"awalsh128.com/cache-apt-pkgs-action/src/internal/cmdtesting"
)

var createReplayLogs bool = false

func init() {
	flag.BoolVar(&createReplayLogs, "createreplaylogs", false, "Execute the test commands, save the command output for future replay and skip the tests themselves.")
}

func TestMain(m *testing.M) {
	cmdtesting.TestMain(m)
}

func TestNormalizedList_MultiplePackagesExists_StdoutsAlphaSortedPackageNameVersionPairs(t *testing.T) {
	result := cmdtesting.New(t, createReplayLogs).Run("normalized-list", "xdot", "rolldice")
	result.ExpectSuccessfulOut("rolldice=1.16-1build1 xdot=1.1-2")
}

func TestNormalizedList_SamePackagesDifferentOrder_StdoutsMatch(t *testing.T) {
	expected := "rolldice=1.16-1build1 xdot=1.1-2"

	ct := cmdtesting.New(t, createReplayLogs)

	result := ct.Run("normalized-list", "rolldice", "xdot")
	result.ExpectSuccessfulOut(expected)

	result = ct.Run("normalized-list", "xdot", "rolldice")
	result.ExpectSuccessfulOut(expected)
}

func TestNormalizedList_MultiVersionWarning_StdoutSingleVersion(t *testing.T) {
	var result = cmdtesting.New(t, createReplayLogs).Run("normalized-list", "libosmesa6-dev", "libgl1-mesa-dev")
	result.ExpectSuccessfulOut("libgl1-mesa-dev=21.2.6-0ubuntu0.1~20.04.2 libosmesa6-dev=21.2.6-0ubuntu0.1~20.04.2")
}

func TestNormalizedList_SinglePackageExists_StdoutsSinglePackageNameVersionPair(t *testing.T) {
	var result = cmdtesting.New(t, createReplayLogs).Run("normalized-list", "xdot")
	result.ExpectSuccessfulOut("xdot=1.1-2")
}

func TestNormalizedList_VersionContainsColon_StdoutsEntireVersion(t *testing.T) {
	var result = cmdtesting.New(t, createReplayLogs).Run("normalized-list", "default-jre")
	result.ExpectSuccessfulOut("default-jre=2:1.11-72")
}

func TestNormalizedList_NonExistentPackageName_StderrsAptCacheErrors(t *testing.T) {
	var result = cmdtesting.New(t, createReplayLogs).Run("normalized-list", "nonexistentpackagename")
	result.ExpectError(
		`Error encountered running apt-cache --quiet=0 --no-all-versions show nonexistentpackagename
Exited with status code 100; see combined std[out,err] below:
N: Unable to locate package nonexistentpackagename
N: Unable to locate package nonexistentpackagename
E: No packages found`)
}

func TestNormalizedList_NoPackagesGiven_StderrsArgMismatch(t *testing.T) {
	var result = cmdtesting.New(t, createReplayLogs).Run("normalized-list")
	result.ExpectError("Expected at least 2 non-flag arguments but found 1.")
}

func TestNormalizedList_VirtualPackagesExists_StdoutsConcretePackage(t *testing.T) {
	result := cmdtesting.New(t, createReplayLogs).Run("normalized-list", "libvips")
	result.ExpectSuccessfulOut("libvips42t64=8.16.0-2build1")
}
