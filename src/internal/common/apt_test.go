package common

import (
	"fmt"
	"strings"
	"testing"

	execpkg "awalsh128.com/cache-apt-pkgs-action/src/internal/exec"
)

type mockExecutor struct {
	executions map[string]*execpkg.Execution
}

func (s mockExecutor) Exec(name string, arg ...string) *execpkg.Execution {
	cmd := name + " " + strings.Join(arg, " ")
	execution, ok := s.executions[cmd]
	if !ok {
		panic(fmt.Sprintf("unexpected command: %s", cmd))
	}
	return execution
}

func TestGetNonVirtualPackage_WithWarningsInReverseProvides(t *testing.T) {
	executor := mockExecutor{
		executions: map[string]*execpkg.Execution{
			"apt-cache showpkg libopenblas0-openmp": {
				Cmd: "apt-cache showpkg libopenblas0-openmp",
				CombinedOut: strings.Join([]string{
					"Package: libopenblas0-openmp",
					"Reverse Provides:",
					"libopenblas0-openmp 0.3.26+ds-1ubuntu0.1 (= )",
					"W: Unable to read /etc/apt/apt.conf.d/99github-actions - open (13: Permission denied)",
					"",
				}, "\n"),
				ExitCode: 0,
			},
		},
	}

	pkg, err := getNonVirtualPackage(executor, "libopenblas0-openmp")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if pkg == nil {
		t.Fatal("expected package but got nil")
	}

	expected := AptPackage{Name: "libopenblas0-openmp", Version: "0.3.26+ds-1ubuntu0.1"}
	if *pkg != expected {
		t.Fatalf("unexpected package.\nexpected: %+v\nactual: %+v", expected, *pkg)
	}
}

// Regression test for https://github.com/awalsh128/cache-apt-pkgs-action/issues/166:
// a virtual package that nothing provides (e.g. python on Ubuntu 22.04) must produce a clear
// error rather than a mangled package such as "Reverse=Provides:".
func TestGetNonVirtualPackage_WithNoReverseProvides_ReturnsNoCandidateError(t *testing.T) {
	executor := mockExecutor{
		executions: map[string]*execpkg.Execution{
			"apt-cache showpkg python": {
				Cmd: "apt-cache showpkg python",
				CombinedOut: strings.Join([]string{
					"Package: python",
					"Versions: ",
					"",
					"Reverse Depends: ",
					"  python-is-python3,python",
					"Dependencies: ",
					"Provides: ",
					"Reverse Provides: ",
					"",
				}, "\n"),
				ExitCode: 0,
			},
		},
	}

	pkg, err := getNonVirtualPackage(executor, "python")
	if err == nil {
		t.Fatalf("expected error but got package %+v", pkg)
	}
	if !strings.Contains(err.Error(), "package 'python' has no installation candidate") {
		t.Fatalf("unexpected error message: %v", err)
	}
	if strings.Contains(err.Error(), "Reverse Depends") {
		t.Fatalf("error message should not dump apt-cache showpkg output: %v", err)
	}
}

func TestGetAptPackages_WithMultipleErrors_ReportsEachOnce(t *testing.T) {
	executor := mockExecutor{
		executions: map[string]*execpkg.Execution{
			"apt-cache --quiet=0 --no-all-versions show python": {
				Cmd:         "apt-cache --quiet=0 --no-all-versions show python",
				CombinedOut: "N: Can't select versions from package 'python' as it is purely virtual\nN: No packages found\n",
				ExitCode:    0,
			},
			"apt-cache showpkg python": {
				Cmd:         "apt-cache showpkg python",
				CombinedOut: "Package: python\nVersions: \n\nReverse Provides: \n",
				ExitCode:    0,
			},
		},
	}

	_, err := GetAptPackages(executor, []string{"python"})
	if err == nil {
		t.Fatal("expected error but got none")
	}
	if count := strings.Count(err.Error(), "package 'python' has no installation candidate"); count != 1 {
		t.Fatalf("expected error reported once but found %d times:\n%v", count, err)
	}
}
