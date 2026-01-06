package cio

import (
	"fmt"
	"os"
	"strings"

	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
	"github.com/sethvargo/go-githubactions"
)

const localPrintPrefix = "ghio::"

// formatPackages formats a Packages collection as a comma-delimited list with = delimiter
// Format: package1=version1,package2=version2,...
func formatPackages(packages pkgs.Packages) string {
	if packages.Len() == 0 {
		return ""
	}

	var parts []string
	for i := 0; i < packages.Len(); i++ {
		pkg := packages.Get(i)
		parts = append(parts, fmt.Sprintf("%s=%s", pkg.Name, pkg.Version))
	}

	return strings.Join(parts, ",")
}

// GhPrinter defines an interface for printing outputs in GitHub Actions or locally
type GhPrinter interface {
	// SetOutput sets an output variable name and value
	SetOutput(name string, value any)
}

// ghActionEnvPrinter implements GhPrinter for GitHub Actions environment
type ghActionEnvPrinter struct {
}

// localPrinter implements GhPrinter for local (non-GitHub Actions) environment
// Used in local testing and debugging
type localPrinter struct {
}

// isGitHubActions checks if the code is running in a GitHub Actions environment
func NewGhPrinter() GhPrinter {
	if os.Getenv("GITHUB_ACTIONS") == "true" {
		return &ghActionEnvPrinter{}
	}
	return &localPrinter{}
}

func (p *ghActionEnvPrinter) SetOutput(name string, value any) {
	switch v := value.(type) {
	case string:
		githubactions.SetOutput(name, v)
	case bool:
		githubactions.SetOutput(name, fmt.Sprintf("%t", v))
	case pkgs.Packages:
		githubactions.SetOutput(name, formatPackages(v))
	default:
		githubactions.SetOutput(name, fmt.Sprintf("%v", v))
	}
}

func (p *localPrinter) SetOutput(name string, value any) {
	switch v := value.(type) {
	case string:
		fmt.Printf("%s%s=%v\n", localPrintPrefix, name, v)
	case bool:
		fmt.Printf("%s%s=%v\n", localPrintPrefix, name, fmt.Sprintf("%t", v))
	case pkgs.Packages:
		fmt.Printf("%s%s=%v\n", localPrintPrefix, name, formatPackages(v))
	default:
		fmt.Printf("%s%s=%v\n", localPrintPrefix, name, fmt.Sprintf("%v", v))
	}
}

// ReadLocalPrinterOutputs reads outputs printed by localPrinter from the given text.
// It returns a map of output names to their values.
// Lines not starting with the localPrintPrefix are ignored.
func ReadLocalPrinterOutputs(text string) map[string]string {
	outputs := make(map[string]string)
	lines := strings.Split(text, "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, localPrintPrefix) {
			parts := strings.SplitN(line[len(localPrintPrefix):], "=", 2)
			if len(parts) == 2 {
				outputs[parts[0]] = parts[1]
			}
		}
	}
	return outputs
}
