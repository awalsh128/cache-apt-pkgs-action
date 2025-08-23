package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"awalsh128.com/cache-apt-pkgs-action/src/internal/pkgs"
)

type Cmd struct {
	Name            string
	Description     string
	Flags           *flag.FlagSet
	Examples        []string // added Examples field for command usage examples
	ExamplePackages *pkgs.Packages
	Run             func(cmd *Cmd, pkgArgs *pkgs.Packages) error
}

// binaryName returns the base name of the command without the path
var binaryName = filepath.Base(os.Args[0])

type Cmds map[string]*Cmd

func (c *Cmd) parseFlags() *pkgs.Packages {
	if len(os.Args) < 3 {
		fmt.Fprintf(os.Stderr, "error: command %q requires arguments\n", c.Name)
		os.Exit(1)
	}
	// Parse the command line flags
	if err := c.Flags.Parse(os.Args[2:]); err != nil {
		fmt.Fprintf(os.Stderr, "error: unable to parse flags for command %q: %v\n", c.Name, err)
		os.Exit(1)
	}

	// Check for missing required flags
	missingFlagNames := []string{}
	c.Flags.VisitAll(func(f *flag.Flag) {
		// Only consider strings as required flags
		if f.Value.String() == "" && f.DefValue != "" && f.Name != "help" {
			missingFlagNames = append(missingFlagNames, f.Name)
		}
	})
	if len(missingFlagNames) > 0 {
		fmt.Fprintf(os.Stderr, "error: missing required flags for command %q: %s\n", c.Name, missingFlagNames)
		os.Exit(1)
	}

	// Parse the remaining arguments as package arguments
	pkgArgs := pkgs.ParsePackageArgs(c.Flags.Args())
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

func (c *Cmds) Parse() (*Cmd, *pkgs.Packages) {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "error: no command specified\n\n")
		printUsage(*c)
		os.Exit(1)
	}

	binaryName := os.Args[1]
	if binaryName == "--help" || binaryName == "-h" {
		printUsage(*c)
		os.Exit(0)
	}

	cmd, ok := c.Get(binaryName)
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
