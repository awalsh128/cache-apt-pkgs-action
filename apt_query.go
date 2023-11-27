package apt_query

import (
	"fmt"
	"os"
	"os/exec"
	"sort"
	"strings"
)

func contains(arr []string, element string) bool {
	for _, x := range arr {
		if x == element {
			return true
		}
	}
	return false
}

// Writes a message to STDERR and exits with status 1.
func exitOnError(format string, arg ...any) {
	fmt.Fprintln(os.Stderr, fmt.Errorf(format+"\n", arg...))
	fmt.Println("Usage: apt_query.go normalized-list <package names>")
	os.Exit(1)
}

type AptPackage struct {
	Name    string
	Version string
}

// Executes a command and either returns the output or exits the programs and writes the output (including error) to STDERR.
func execCommand(name string, arg ...string) string {
	cmd := exec.Command(name, arg...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		fmt.Fprintln(os.Stderr, fmt.Sprintf("Error code %d encountered while running %s\n%s", cmd.ProcessState.ExitCode(), strings.Join(cmd.Args, " "), string(out)))
		os.Exit(2)
	}
	return string(out)
}

// Gets the APT based packages as a sorted by name list (normalized).
func getPackages(names []string) []AptPackage {
	prefixArgs := []string{"--quiet=0", "--no-all-versions", "show"}
	out := execCommand("apt-cache", append(prefixArgs, names...)...)

	packages := []AptPackage{}
	errorMessages := []string{}

	for _, paragraph := range strings.Split(string(out), "\n\n") {
		pkg := AptPackage{}
		for _, line := range strings.Split(paragraph, "\n") {
			if strings.HasPrefix(line, "Package: ") {
				pkg.Name = strings.TrimSpace(strings.Split(line, ":")[1])
			} else if strings.HasPrefix(line, "Version: ") {
				pkg.Version = strings.TrimSpace(strings.Split(line, ":")[1])
			} else if strings.HasPrefix(line, "N: ") || strings.HasPrefix(line, "E: ") {
				if !contains(errorMessages, line) {
					errorMessages = append(errorMessages, line)
				}
			}
		}
		if pkg.Name != "" {
			packages = append(packages, pkg)
		}
	}

	if len(errorMessages) > 0 {
		exitOnError("Errors encountered in apt-cache output (see below):\n%s", strings.Join(errorMessages, "\n"))
	}

	sort.Slice(packages, func(i, j int) bool {
		return packages[i].Name < packages[j].Name
	})

	return packages
}

func serialize(packages []AptPackage) string {
	tokens := []string{}
	for _, pkg := range packages {
		tokens = append(tokens, pkg.Name+"="+pkg.Version)
	}
	return strings.Join(tokens, " ")
}

func main() {
	if len(os.Args) < 3 {
		exitOnError("Expected at least 2 arguments but found %d.", len(os.Args)-1)
		return
	}

	command := os.Args[1]
	packageNames := os.Args[2:]

	switch command {
	case "normalized-list":
		fmt.Println(serialize(getPackages(packageNames)))
		break
	default:
		exitOnError("Command '%s' not recognized.", command)
	}
}
