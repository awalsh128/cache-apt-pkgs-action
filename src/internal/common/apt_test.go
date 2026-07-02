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

// Regression test for https://github.com/awalsh128/cache-apt-pkgs-action/issues/218
// A real package (ghostscript) that is mis-identified as purely virtual due to stale apt lists
// has an empty "Reverse Provides:" section in apt-cache showpkg.  getNonVirtualPackage must
// fall back to the "Versions:" section and return the package itself rather than failing or
// returning the section header as the package name.
func TestGetNonVirtualPackage_WithRealPackageMisidentifiedAsVirtual(t *testing.T) {
	executor := mockExecutor{
		executions: map[string]*execpkg.Execution{
			"apt-cache showpkg ghostscript": {
				Cmd: "apt-cache showpkg ghostscript",
				CombinedOut: strings.Join([]string{
					"Package: ghostscript",
					"Versions: ",
					"10.02.1~dfsg1-0ubuntu7.8 (/var/lib/dpkg/info/ghostscript.list)",
					" Description Language: ",
					"                 File: /var/lib/apt/lists/example",
					"                  MD5: abc123",
					"",
					"Reverse Depends: ",
					"  cups,ghostscript",
					"Dependencies: ",
					"10.02.1~dfsg1-0ubuntu7.8 - libgs10 (5 10.02.1~dfsg1-0ubuntu7.8)",
					"Provides: ",
					"10.02.1~dfsg1-0ubuntu7.8 - postscript-viewer (= ) ghostscript-x (= 10.02.1~dfsg1-0ubuntu7.8)",
					"Reverse Provides: ",
					"",
				}, "\n"),
				ExitCode: 0,
			},
		},
	}

	pkg, err := getNonVirtualPackage(executor, "ghostscript")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if pkg == nil {
		t.Fatal("expected package but got nil")
	}

	expected := AptPackage{Name: "ghostscript", Version: "10.02.1~dfsg1-0ubuntu7.8"}
	if *pkg != expected {
		t.Fatalf("unexpected package.\nexpected: %+v\nactual: %+v", expected, *pkg)
	}
}

// Regression test: when the "Reverse Provides:" header and entry appear on the same line
// (e.g. "Reverse Provides: provider 1.0"), the entry must be parsed correctly and the
// section header must not be treated as the package name.
func TestGetNonVirtualPackage_WithInlineReverseProvides(t *testing.T) {
	executor := mockExecutor{
		executions: map[string]*execpkg.Execution{
			"apt-cache showpkg somevirtual": {
				Cmd: "apt-cache showpkg somevirtual",
				CombinedOut: strings.Join([]string{
					"Package: somevirtual",
					"Versions: ",
					"",
					"Reverse Provides: concrete-pkg 2.0.0 (= 2.0.0)",
					"",
				}, "\n"),
				ExitCode: 0,
			},
		},
	}

	pkg, err := getNonVirtualPackage(executor, "somevirtual")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if pkg == nil {
		t.Fatal("expected package but got nil")
	}

	expected := AptPackage{Name: "concrete-pkg", Version: "2.0.0"}
	if *pkg != expected {
		t.Fatalf("unexpected package.\nexpected: %+v\nactual: %+v", expected, *pkg)
	}
}

// Edge case: "Reverse Provides: " header with no parseable inline entry falls back to
// scanning subsequent lines, then to the Versions fallback if still no entries are found.
func TestGetNonVirtualPackage_WithInlineHeaderNoEntry(t *testing.T) {
	executor := mockExecutor{
		executions: map[string]*execpkg.Execution{
			"apt-cache showpkg realpkg": {
				Cmd: "apt-cache showpkg realpkg",
				CombinedOut: strings.Join([]string{
					"Package: realpkg",
					"Versions: ",
					"1.2.3 (/var/lib/dpkg/info/realpkg.list)",
					"Reverse Provides: ",
					"",
				}, "\n"),
				ExitCode: 0,
			},
		},
	}

	pkg, err := getNonVirtualPackage(executor, "realpkg")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if pkg == nil {
		t.Fatal("expected package but got nil")
	}

	expected := AptPackage{Name: "realpkg", Version: "1.2.3"}
	if *pkg != expected {
		t.Fatalf("unexpected package.\nexpected: %+v\nactual: %+v", expected, *pkg)
	}
}
