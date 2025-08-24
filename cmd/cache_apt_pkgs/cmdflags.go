package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"awalsh128.com/cache-apt-pkgs-action/internal/logging"
	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

var ExamplePackages = pkgs.NewPackages(
	pkgs.Package{Name: "rolldice"},
	pkgs.Package{Name: "xdot", Version: "1.1-2"},
	pkgs.Package{Name: "libgtk-3-dev"},
)

type Cmd struct {
	Name            string
	Description     string
	Flags           *flag.FlagSet
	Examples        []string // added Examples field for command usage examples
	ExamplePackages pkgs.Packages
	Run             func(cmd *Cmd, pkgArgs pkgs.Packages) error
}

// StringFlag returns the string value of a flag by name.
func (c *Cmd) StringFlag(name string) string {
	return c.Flags.Lookup(name).Value.String()
}

// binaryName returns the base name of the command without the path
var binaryName = filepath.Base(os.Args[0])

type Cmds map[string]*Cmd

func (c *Cmd) parseFlags() pkgs.Packages {
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
		// Consider all flags as required
		if f.Value.String() == "" && f.DefValue == "" && f.Name != "help" {
			logging.Info("Missing required flag: %s", f.Name)
			missingFlagNames = append(missingFlagNames, f.Name)
		}
	})
	if len(missingFlagNames) > 0 {
		logging.Fatalf("missing required flags for command %q: %s", c.Name, missingFlagNames)
	}

	// Parse the remaining arguments as package arguments
	pkgArgs, err := pkgs.ParsePackageArgs(c.Flags.Args())
	if err != nil {
		logging.Fatalf("failed to parse package arguments for command %q: %v", c.Name, err)
	}
	return pkgArgs
}

func (c *Cmds) Add(cmd *Cmd) error {
	if _, exists := (*c)[cmd.Name]; exists {
		return fmt.Errorf("command %q already exists", cmd.Name)
	}
	(*c)[cmd.Name] = cmd
	return nil
}
func (c *Cmds) Get(name string) (*Cmd, bool) {
	cmd, ok := (*c)[name]
	return cmd, ok
}
func (c *Cmd) getFlagCount() int {
	count := 0
	c.Flags.VisitAll(func(f *flag.Flag) {
		count++
	})
	return count
}

func (c *Cmd) help() {
	if c.getFlagCount() == 0 {
		fmt.Fprintf(os.Stderr, "usage: %s %s [packages]\n\n", binaryName, c.Name)
		fmt.Fprintf(os.Stderr, "%s\n\n", c.Description)
	} else {
		fmt.Fprintf(os.Stderr, "usage: %s %s [flags] [packages]\n\n", binaryName, c.Name)
		fmt.Fprintf(os.Stderr, "%s\n\n", c.Description)
		fmt.Fprintf(os.Stderr, "Flags:\n")
		c.Flags.PrintDefaults()
	}

	if c.ExamplePackages == nil && len(c.Examples) == 0 {
		return
	}
	fmt.Fprintf(os.Stderr, "\nExamples:\n")
	if len(c.Examples) == 0 {
		fmt.Fprintf(os.Stderr, "  %s %s %s\n", binaryName, c.Name, c.ExamplePackages.String())
		return
	}
	for _, example := range c.Examples {
		fmt.Fprintf(os.Stderr, "  %s %s %s %s\n", binaryName, c.Name, example, c.ExamplePackages.String())
	}
}

func printUsage(cmds Cmds) {
	fmt.Fprintf(os.Stderr, "usage: %s <command> [flags] [packages]\n\n", binaryName)
	fmt.Fprintf(os.Stderr, "commands:\n")

	// Get max length for alignment
	maxLen := 0
	for name := range cmds {
		if len(name) > maxLen {
			maxLen = len(name)
		}
	}

	// Print aligned command descriptions
	for name, cmd := range cmds {
		fmt.Fprintf(os.Stderr, "  %-*s  %s\n", maxLen, name, cmd.Description)
	}

	fmt.Fprintf(os.Stderr, "\nUse \"%s <command> --help\" for more information about a command\n", binaryName)
}

func (c *Cmds) Parse() (*Cmd, pkgs.Packages) {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "error: no command specified\n\n")
		printUsage(*c)
		os.Exit(1)
	}

	cmdName := os.Args[1]
	if cmdName == "--help" || cmdName == "-h" {
		printUsage(*c)
		os.Exit(0)
	}

	cmd, ok := c.Get(cmdName)
	if !ok {
		fmt.Fprintf(os.Stderr, "error: unknown command %q\n\n", binaryName)
		printUsage(*c)
		os.Exit(1)
	}

	// Handle command-specific help
	for _, arg := range os.Args[2:] {
		if arg == "--help" || arg == "-h" {
			cmd.help()
			os.Exit(0)
		}
	}

	pkgArgs := cmd.parseFlags()
	if pkgArgs == nil {
		fmt.Fprintf(os.Stderr, "error: no package arguments specified for command %q\n\n", cmd.Name)
		cmd.help()
		os.Exit(1)
	}

	return cmd, pkgArgs
}

func CreateCmds(cmd ...*Cmd) *Cmds {
	commands := &Cmds{}
	for _, c := range cmd {
		commands.Add(c)
	}
	return commands
}
