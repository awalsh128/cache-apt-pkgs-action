package cmdflags

import (
	"flag"
	"fmt"
	"os"

	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

// Cmds is a collection of subcommands indexed by their names.
// It provides methods for managing and executing CLI subcommands.
type Cmds map[string]*Cmd

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

// usage prints the overall usage help for all commands.
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

// Parse processes the command line arguments to determine the command to run
// and its package arguments. Handles help requests and invalid commands.
// Returns the command, package arguments, and any error encountered.
func (c *Cmds) Parse() (*Cmd, pkgs.Packages, error) {
	if len(os.Args) < 2 {
		c.usage()
		return nil, nil, fmt.Errorf("no command specified")
	}

	cmdName := os.Args[1]
	if cmdName == "--"+helpFlagName || cmdName == "-"+helpShortFlagName {
		c.usage()
		return nil, nil, nil
	}

	cmd, ok := c.Get(cmdName)
	if !ok {
		c.usage()
		return nil, nil, fmt.Errorf("unknown command %q", cmdName)
	}

	pkgArgs, err := cmd.parseFlags()
	if err != nil {
		return nil, nil, err
	}
	if pkgArgs == nil {
		return nil, nil, fmt.Errorf("failed to parse package arguments for command %q", cmd.Name)
	}

	return cmd, pkgArgs, nil
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
