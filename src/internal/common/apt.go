package common

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	"awalsh128.com/cache-apt-pkgs-action/src/internal/exec"
	"awalsh128.com/cache-apt-pkgs-action/src/internal/logging"
)

// An APT package name and version representation.
type AptPackage struct {
	Name    string
	Version string
}

type AptPackages []AptPackage

// Serialize the APT packages into lines of <name>=<version>.
func (ps AptPackages) Serialize() string {
	tokens := []string{}
	for _, p := range ps {
		tokens = append(tokens, p.Name+"="+p.Version)
	}
	return strings.Join(tokens, " ")
}

func isErrLine(line string) bool {
	return strings.HasPrefix(line, "E: ") || strings.HasPrefix(line, "N: ")
}

// Resolves virtual packages names to their concrete one.
func getNonVirtualPackage(executor exec.Executor, name string) (pkg *AptPackage, err error) {
	execution := executor.Exec("bash", "-c", fmt.Sprintf("apt-cache showpkg %s | grep -A 1 \"Reverse Provides\" | tail -1", name))
	err = execution.Error()
	if err != nil {
		logging.Fatal(err)
		return pkg, err
	}
	if isErrLine(execution.CombinedOut) {
		return pkg, execution.Error()
	}
	splitLine := GetSplitLine(execution.CombinedOut, " ", 3)
	if len(splitLine.Words) < 2 {
		return pkg, fmt.Errorf("unable to parse space delimited line's package name and version from apt-cache showpkg output below:\n%s", execution.CombinedOut)
	}
	return &AptPackage{Name: splitLine.Words[0], Version: splitLine.Words[1]}, nil
}

func getPackage(executor exec.Executor, paragraph string) (pkg *AptPackage, err error) {
	errMsgs := []string{}
	for _, splitLine := range GetSplitLines(paragraph, ":", 2) {
		if len(splitLine.Words) < 2 {
			logging.Debug("Skipping invalid line: %+v\n", splitLine.Line)
			continue
		}
		switch splitLine.Words[0] {
		case "Package":
			// Initialize since this will provide the first struct value if present.
			pkg = &AptPackage{}
			pkg.Name = splitLine.Words[1]

		case "Version":
			pkg.Version = splitLine.Words[1]

		case "N":
			// e.g.  Can't select versions from package 'libvips' as it is purely virtual
			if strings.Contains(splitLine.Words[1], "as it is purely virtual") {
				return getNonVirtualPackage(executor, GetSplitLine(splitLine.Words[1], "'", 4).Words[2])
			}
			if strings.HasPrefix(splitLine.Words[1], "Unable to locate package") && !ArrContainsString(errMsgs, splitLine.Line) {
				errMsgs = append(errMsgs, splitLine.Line)
			}
		case "E":
			if !ArrContainsString(errMsgs, splitLine.Line) {
				errMsgs = append(errMsgs, splitLine.Line)
			}
		}
	}
	if len(errMsgs) == 0 {
		return pkg, nil
	}
	return pkg, errors.New(strings.Join(errMsgs, "\n"))
}

// Gets the APT based packages as a sorted by package name list (normalized).
func GetAptPackages(executor exec.Executor, names []string) (AptPackages, error) {
	prefixArgs := []string{"--quiet=0", "--no-all-versions", "show"}
	execution := executor.Exec("apt-cache", append(prefixArgs, names...)...)
	pkgs := []AptPackage{}

	err := execution.Error()
	if err != nil {
		logging.Fatal(err)
		return pkgs, err
	}

	errMsgs := []string{}

	for _, paragraph := range strings.Split(execution.CombinedOut, "\n\n") {
		trimmed := strings.TrimSpace(paragraph)
		if trimmed == "" {
			continue
		}
		pkg, err := getPackage(executor, trimmed)
		if err != nil {
			errMsgs = append(errMsgs, err.Error())
		} else if pkg != nil { // Ignore cases where no package parsed and no errors occurred.
			pkgs = append(pkgs, *pkg)
		}
	}

	if len(errMsgs) > 0 {
		errMsgs = append(errMsgs, strings.Join(errMsgs, "\n"))
	}

	sort.Slice(pkgs, func(i, j int) bool {
		return pkgs[i].Name < pkgs[j].Name
	})
	if len(errMsgs) > 0 {
		return pkgs, errors.New(strings.Join(errMsgs, "\n"))
	}

	return pkgs, nil
}
