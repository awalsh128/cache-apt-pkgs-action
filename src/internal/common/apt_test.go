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
