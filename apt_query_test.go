package main

import (
	"bytes"
	"os/exec"
	"testing"
)

type RunResult struct {
	TestContext *testing.T
	Stdout      string
	Stderr      string
	Err         error
}

func run(t *testing.T, command string, pkgNames ...string) RunResult {
	stdout := &bytes.Buffer{}
	stderr := &bytes.Buffer{}
	cmd := exec.Command("go", append([]string{"run", "apt_query.go", command}, pkgNames...)...)
	cmd.Stdout = stdout
	cmd.Stderr = stderr
	err := cmd.Run()
	return RunResult{TestContext: t, Stdout: stdout.String(), Stderr: stderr.String(), Err: err}
}

func (r *RunResult) expectSuccessfulOut(expected string) {
	if r.Err != nil {
		r.TestContext.Errorf("Error running command: %v", r.Err)
		return
	}
	if r.Stderr != "" {
		r.TestContext.Errorf("Unexpected stderr messages found.\nExpected: none\nActual:\n'%s'", r.Stderr)
	}
	fullExpected := expected + "\n" // Output will always have a end of output newline.
	if r.Stdout != fullExpected {   // Output will always have a end of output newline.
		r.TestContext.Errorf("Unexpected stdout found.\nExpected:\n'%s'\nActual:\n'%s'", fullExpected, r.Stdout)
	}
}

func (r *RunResult) expectError(expected string) {
	fullExpected := expected + "\n" // Output will always have a end of output newline.
	if r.Stderr != fullExpected {
		r.TestContext.Errorf("Unexpected stderr found.\nExpected:\n'%s'\nActual:\n'%s'", fullExpected, r.Stderr)
	}
}

func TestNormalizedList_MultiplePackagesExists_StdoutsAlphaSortedPackageNameVersionPairs(t *testing.T) {
	result := run(t, "normalized-list", "xdot", "rolldice")
	result.expectSuccessfulOut("rolldice=1.16-1build1 xdot=1.2-3")
}

func TestNormalizedList_SamePackagesDifferentOrder_StdoutsMatch(t *testing.T) {
	expected := "rolldice=1.16-1build1 xdot=1.2-3"

	result := run(t, "normalized-list", "rolldice", "xdot")
	result.expectSuccessfulOut(expected)

	result = run(t, "normalized-list", "xdot", "rolldice")
	result.expectSuccessfulOut(expected)
}

func TestNormalizedList_SinglePackageExists_StdoutsSinglePackageNameVersionPair(t *testing.T) {
	var result = run(t, "normalized-list", "xdot")
	result.expectSuccessfulOut("xdot=1.2-3")
}

func TestNormalizedList_VersionContainsColon_StdoutsEntireVersion(t *testing.T) {
	var result = run(t, "normalized-list", "default-jre")
	result.expectSuccessfulOut("default-jre=2:1.17-74")
}

func TestNormalizedList_NonExistentPackageName_StderrsAptCacheErrors(t *testing.T) {
	var result = run(t, "normalized-list", "nonexistentpackagename")
	result.expectError(
		`Error code 100 encountered while running apt-cache --quiet=0 --no-all-versions show nonexistentpackagename
N: Unable to locate package nonexistentpackagename
N: Unable to locate package nonexistentpackagename
E: No packages found

exit status 2`)
}

func TestNormalizedList_NoPackagesGiven_StderrsArgMismatch(t *testing.T) {
	var result = run(t, "normalized-list")
	result.expectError(
		`Expected at least 2 arguments but found 1.

exit status 1`)
}
