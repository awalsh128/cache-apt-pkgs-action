// Package main implements the cache-apt-pkgs command line tool.
// It provides functionality to cache and restore APT packages in GitHub Actions,
// with commands for creating cache keys, installing packages, and restoring from cache.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"awalsh128.com/cache-apt-pkgs-action/internal/logging"
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

// globalFlags defines the command-line flags that apply to all commands.
// It includes options for verbosity and help documentation.
var globalFlags = func() *flag.FlagSet {
	flags := flag.NewFlagSet("global", flag.ExitOnError)
	flags.BoolVar(new(bool), "verbose", false, "Enable verbose logging")
	flags.BoolVar(new(bool), "v", false, "Enable verbose logging (shorthand)")
	flags.BoolVar(new(bool), "help", false, "Show help")
	flags.BoolVar(new(bool), "h", false, "Show help (shorthand)")
	return flags
}()

func (c *Cmds) usage() {
	fmt.Fprintf(os.Stderr, "usage: %s <command> [flags] [packages]\n\n", binaryName)
	fmt.Fprintf(os.Stderr, "commands:\n")
	for _, cmd := range *c {
		fmt.Fprintf(os.Stderr, "  %s: %s\n", cmd.Name, cmd.Description)
	}
	fmt.Fprintf(os.Stderr, "\nflags:\n")
	// Print global flags (from any command, since they are the same)
	globalFlags.VisitAll(func(f *flag.Flag) {
		fmt.Fprintf(os.Stderr, "  -%s: %s\n", f.Name, f.Usage)
	})
	fmt.Fprintf(os.Stderr, "\nUse \"%s <command> --help\" for more information about a command.\n", binaryName)
}

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
	Run             func(cmd *Cmd, pkgArgs pkgs.Packages) error
	Examples        []string
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
	return &Cmd{
		Name:            name,
		Description:     description,
		Flags:           flags,
		Run:             runFunc,
		Examples:        examples,
		ExamplePackages: ExamplePackages,
	}
}

// StringFlag returns the string value of a flag by name.
// It panics if the flag does not exist, so ensure the flag exists before calling.
func (c *Cmd) StringFlag(name string) string {
	return c.Flags.Lookup(name).Value.String()
}

// Cmds is a collection of subcommands indexed by their names.
// It provides methods for managing and executing CLI subcommands.
type Cmds map[string]*Cmd

// parseFlags processes command line arguments for the command.
// It validates required flags and parses package arguments.
// Returns the parsed package arguments or exits with an error if validation fails.
func (c *Cmd) parseFlags() pkgs.Packages {
	logging.Debug("Parsing flags for command %q with args: %v", c.Name, os.Args[2:])
	if len(os.Args) < 3 {
		logging.Fatalf("command %q requires arguments", c.Name)
	}
	// Parse the command line flags
	if err := c.Flags.Parse(os.Args[2:]); err != nil {
		logging.Fatalf("unable to parse flags for command %q: %v", c.Name, err)
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
		logging.Fatalf("missing required flags for command %q: %s", c.Name, missingFlagNames)
	}
	logging.Debug("Parsed flags successfully")

	// Parse the remaining arguments as package arguments
	pkgArgs, err := pkgs.ParsePackageArgs(c.Flags.Args())
	if err != nil {
		logging.Fatalf("failed to parse package arguments for command %q: %v", c.Name, err)
	}
	logging.Debug("Parsed package arguments:\n%s", strings.Join(c.Flags.Args(), "\n  "))
	return pkgArgs
}

// Add registers a new command to the command set.
// Returns an error if a command with the same name already exists.
func (c *Cmds) Add(cmd *Cmd) error {
	if _, exists := (*c)[cmd.Name]; exists {
		return fmt.Errorf("command %q already exists", cmd.Name)
	}
	(*c)[cmd.Name] = cmd
	return nil
}

// Get retrieves a command by name.
// Returns the command and true if found, or nil and false if not found.
func (c *Cmds) Get(name string) (*Cmd, bool) {
	cmd, ok := (*c)[name]
	return cmd, ok
}

// Parse processes the command line arguments to determine the command to run
// and its package arguments. Handles help requests and invalid commands.
// Returns the selected command and its parsed package arguments, or exits on error.
func (c *Cmds) Parse() (*Cmd, pkgs.Packages) {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "error: no command specified\n\n")
		c.usage()
		os.Exit(1)
	}

	cmdName := os.Args[1]
	if cmdName == "--help" || cmdName == "-h" {
		c.usage()
		os.Exit(0)
	}

	cmd, ok := c.Get(cmdName)
	if !ok {
		fmt.Fprintf(os.Stderr, "error: unknown command %q\n\n", binaryName)
		c.usage()
		os.Exit(1)
	}

	// Handle command-specific help
	for _, arg := range os.Args[2:] {
		if arg == "--help" || arg == "-h" {
			c.usage()
			os.Exit(0)
		}
	}

	pkgArgs := cmd.parseFlags()
	if pkgArgs == nil {
		fmt.Fprintf(os.Stderr, "error: no package arguments specified for command %q\n\n", cmd.Name)
		cmd.Flags.Usage()
		os.Exit(1)
	}

	return cmd, pkgArgs
}

// CreateCmds initializes a new command set with the provided commands.
// Each command is added to the set, and the resulting set is returned.
func CreateCmds(cmd ...*Cmd) *Cmds {
	commands := &Cmds{}
	for _, c := range cmd {
		commands.Add(c)
	}
	return commands
}
