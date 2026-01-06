// Package cmdflags provides types and utilities for parsing command-line flags
// and managing subcommands in the cache-apt-pkgs CLI tool.
package cmdflags

import (
	"flag"
	"os"
	"path/filepath"

	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

// ExamplePackages provides a set of sample packages used for testing and documentation.
// It includes rolldice, xdot with a specific version, and libgtk-3-dev.
var ExamplePackages = pkgs.NewPackages(
	pkgs.Package{Name: "rolldice"},
	pkgs.Package{Name: "xdot", Version: "1.1-2"},
	pkgs.Package{Name: "libgtk-3-dev"},
)

// binaryName is the base name of the command executable, used in usage and error messages.
var binaryName = filepath.Base(os.Args[0])

const (
	helpFlagName      = "help"
	helpShortFlagName = "h"
)

// globalFlags defines the command-line flags that apply to all commands.
// It includes options for verbosity and help documentation.
var globalFlags = func() *flag.FlagSet {
	flags := flag.NewFlagSet("global", flag.ExitOnError)
	flags.BoolVar(new(bool), "verbose", false, "Enable verbose logging")
	flags.BoolVar(new(bool), "v", false, "Enable verbose logging (shorthand)")
	flags.BoolVar(new(bool), helpFlagName, false, "Show help")
	flags.BoolVar(new(bool), helpShortFlagName, false, "Show help (shorthand)")
	return flags
}()

// helpFlagSet checks if the help flag is set in the given flag set.
func helpFlagSet(flags *flag.FlagSet) bool {
	for _, name := range []string{helpFlagName, helpShortFlagName} {
		if f := flags.Lookup(name); f != nil && f.Value.String() == "true" {
			return true
		}
	}
	return false
}
