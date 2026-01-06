// Package cmdflags provides types and utilities for parsing command-line flags
// and managing subcommands in the cache-apt-pkgs CLI tool.
package cmdflags

import (
	"flag"
	"fmt"
	"os"
	"strings"

	"awalsh128.com/cache-apt-pkgs-action/internal/cio"
	"awalsh128.com/cache-apt-pkgs-action/internal/logging"
	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

// Cmd represents a command-line subcommand with its associated flags and behavior.
// Each command has a name, description, set of flags, and a function to execute the command.
type Cmd struct {
	// Name is the command identifier used in CLI arguments
	Name string
	// Description explains what the command does
	Description string
	// Flags contains the command-specific command-line flags
	Flags *flag.FlagSet
	// Run executes the command with the given packages and returns any errors
	Run func(cmd *Cmd, pkgArgs pkgs.Packages) error
	// GhioPrinter provides an interface for GitHub Actions output printing that supports testing
	// locally and in Action workflows
	GhioPrinter cio.GhPrinter
	// Examples provides example usage strings for the command
	Examples []string
	// ExamplePackages provides example package arguments for documentation and testing
	ExamplePackages pkgs.Packages
}

// NewCmd creates a new command with the given name, description, examples, and run function.
// It automatically includes global flags and sets up the usage documentation.
// The returned Cmd is ready to be used as a subcommand in the CLI.
func NewCmd(name, description string, examples []string, runFunc func(cmd *Cmd, pkgArgs pkgs.Packages) error) *Cmd {
	flags := flag.NewFlagSet(name, flag.ExitOnError)
	globalFlags.VisitAll(func(f *flag.Flag) {
		flags.Var(f.Value, f.Name, f.Usage)
	})
	flags.Usage = func() {
		fmt.Fprintf(os.Stderr, "usage: %s %s [flags] [packages]\n\n%s\n\n", binaryName, name, description)
		fmt.Fprintf(os.Stderr, "flags:\n")
		flags.VisitAll(func(f *flag.Flag) {
			fmt.Fprintf(os.Stderr, "  -%s: %s\n", f.Name, f.Usage)
		})
		fmt.Fprintf(os.Stderr, "\nexamples:\n")
		for _, example := range examples {
			fmt.Fprintf(os.Stderr, "  %s %s %s\n", binaryName, name, example)
		}
	}
	wrappedRunFunc := func(cmd *Cmd, pkgArgs pkgs.Packages) error {
		// If any command args include help flag, print usage and don't execute command.
		if helpFlagSet(cmd.Flags) {
			cmd.Flags.Usage()
			return nil
		}
		return runFunc(cmd, pkgArgs)
	}
	return &Cmd{
		Name:            name,
		Description:     description,
		Flags:           flags,
		Run:             wrappedRunFunc,
		GhioPrinter:     cio.NewGhPrinter(),
		Examples:        examples,
		ExamplePackages: ExamplePackages,
	}
}

// StringFlag returns the string value of a flag by name.
// It panics if the flag does not exist, so ensure the flag exists before calling.
func (c *Cmd) StringFlag(name string) string {
	return c.Flags.Lookup(name).Value.String()
}

// parseFlags processes command line arguments for the command.
// It validates required flags and parses package arguments.
// Returns the parsed package arguments or exits with an error if validation fails.
func (c *Cmd) parseFlags() (pkgs.Packages, error) {
	logging.Debug("Parsing flags for command %q with args: %v", c.Name, os.Args[2:])
	if len(os.Args) < 3 {
		return nil, fmt.Errorf("command %q requires arguments", c.Name)
	}
	// Parse the command line flags
	if err := c.Flags.Parse(os.Args[2:]); err != nil {
		return nil, fmt.Errorf("unable to parse flags for command %q: %v", c.Name, err)
	}

	// Check for missing required flags
	missingFlagNames := []string{}
	c.Flags.VisitAll(func(f *flag.Flag) {
		// Skip all global flags since they are considered optional
		if gf := globalFlags.Lookup(f.Name); gf != nil {
			return
		}
		if f.DefValue == "" && f.Value.String() == "" {
			logging.Info("Missing required flag: %s", f.Name)
			missingFlagNames = append(missingFlagNames, f.Name)
		}
	})
	if len(missingFlagNames) > 0 {
		return nil, fmt.Errorf("missing required flags for command %q: %s", c.Name, missingFlagNames)
	}
	logging.Debug("Parsed flags successfully")

	// Parse the remaining arguments as package arguments
	pkgArgs, err := pkgs.ParsePackageArgs(c.Flags.Args())
	if err != nil {
		return nil, fmt.Errorf("failed to parse package arguments for command %q: %v", c.Name, err)
	}
	logging.Debug("Parsed package arguments:\n%s", strings.Join(c.Flags.Args(), "\n  "))
	return pkgArgs, nil
}
