package actions

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

const parserIndentSize = 2

// Action represents a complete GitHub Action configuration with all its metadata,
// inputs, outputs, and execution details.
//
// Action corresponds to the structure of an action.yml file and contains all
// necessary information to define a GitHub Action including:
//   - Metadata (name, description, author)
//   - Branding (icon, color for GitHub marketplace)
//   - Inputs (parameters that can be passed to the action)
//   - Outputs (values the action produces)
//   - Runs (execution configuration and steps)
//
// Example:
//
//	action := &Action{
//	    Name:        "My Action",
//	    Description: "Does something useful",
//	    Author:      "username",
//	    Inputs:      Inputs{...},
//	    Outputs:     Outputs{...},
//	    Runs:        Runs{...},
//	}
//
// Actions can be loaded from YAML files:
//
//	action := &Action{}
//	err := action.LoadFromFile("action.yml")
type Action struct {
	Name        string   `yaml:"name"`
	Description string   `yaml:"description"`
	Author      string   `yaml:"author"`
	Branding    Branding `yaml:"branding"`
	Inputs      Inputs   `yaml:"inputs"`
	Outputs     Outputs  `yaml:"outputs"`
	Runs        Runs     `yaml:"runs"`
}

// Branding represents the action's branding configuration for display in the
// GitHub marketplace.
//
// The branding information controls how the action appears visually:
//   - Icon: The feather icon to use (see GitHub's supported icons)
//   - Color: The background color (white, yellow, blue, green, orange, red, purple, gray-dark)
//
// Example:
//
//	branding := Branding{
//	    Icon:  "archive",
//	    Color: "gray-dark",
//	}
type Branding struct {
	Icon  string `yaml:"icon"`
	Color string `yaml:"color"`
}

// Inputs represents all input parameters for the action as a map of input names
// to their configurations.
//
// Each key in the map is the input name, and the value is the Input configuration
// that defines the parameter's properties.
//
// Example:
//
//	inputs := Inputs{
//	    "key": Input{
//	        Description: "Cache key",
//	        Required:    true,
//	    },
//	    "path": Input{
//	        Description: "Files to cache",
//	        Required:    true,
//	    },
//	}
type Inputs map[string]Input

// Input represents a single input parameter configuration for an action.
//
// An input defines a parameter that can be passed to the action when it's used.
// It includes:
//   - Description: Human-readable description of the parameter
//   - Required: Whether the parameter must be provided
//   - Default: Default value if not provided (only valid if Required is false)
//   - DeprecationMessage: Optional message if the input is deprecated
//
// Example:
//
//	input := Input{
//	    Description: "An explicit key for a cache entry",
//	    Required:    true,
//	}
//
//	inputWithDefault := Input{
//	    Description: "Enable debug mode",
//	    Required:    false,
//	    Default:     "false",
//	}
type Input struct {
	Description        string `yaml:"description"`
	Required           bool   `yaml:"required"`
	Default            string `yaml:"default"`
	DeprecationMessage string `yaml:"deprecationMessage,omitempty"`
}

// Outputs represents all output parameters from the action as a map of output
// names to their configurations.
//
// Each key in the map is the output name, and the value is the Output configuration
// that defines what the output represents and how it's computed.
//
// Example:
//
//	outputs := Outputs{
//	    "cache-hit": Output{
//	        Description: "Whether cache was found",
//	        Value:       "${{ steps.cache.outputs.cache-hit }}",
//	    },
//	}
type Outputs map[string]Output

// Output represents a single output parameter configuration from an action.
//
// An output defines a value that the action produces which can be used by
// subsequent steps in a workflow.
//   - Description: Human-readable description of the output
//   - Value: Expression that computes the output value (uses GitHub Actions expression syntax)
//
// Example:
//
//	output := Output{
//	    Description: "A boolean value to indicate an exact match was found",
//	    Value:       "${{ steps.restore.outputs.cache-hit }}",
//	}
type Output struct {
	Description string `yaml:"description"`
	Value       string `yaml:"value"`
}

// Runs represents the action's execution configuration.
//
// This defines how the action executes, including:
//   - Using: The runtime environment (e.g., "composite", "node20", "docker")
//   - Env: Environment variables available during execution
//   - Steps: Sequence of steps to execute (for composite actions)
//
// For composite actions, Steps contains the commands to run.
// For other action types, this may reference a main entry point.
//
// Example:
//
//	runs := Runs{
//	    Using: "composite",
//	    Steps: []Step{
//	        {ID: "install", Run: "npm install"},
//	        {ID: "test", Run: "npm test"},
//	    },
//	}
type Runs struct {
	Using string            `yaml:"using"`
	Main  string            `yaml:"main,omitempty"`
	Env   map[string]string `yaml:"env"`
	Steps []Step            `yaml:"steps"`
}

// Step represents a single step in the action's execution sequence.
//
// A step can either:
//   - Run a shell command (via Run field)
//   - Use another action (via Uses field)
//
// Fields:
//   - ID: Unique identifier for the step
//   - Uses: Reference to another action (e.g., "actions/checkout@v4")
//   - With: Input parameters for the referenced action
//   - Shell: Shell to use for execution (e.g., "bash", "pwsh")
//   - Run: Shell command to execute
//   - Env: Environment variables for this step
//
// Example (running a command):
//
//	step := Step{
//	    ID:    "build",
//	    Shell: "bash",
//	    Run:   "go build -v ./...",
//	}
//
// Example (using another action):
//
//	step := Step{
//	    ID:   "cache-restore",
//	    Uses: "actions/cache/restore@v4",
//	    With: map[string]string{
//	        "key":  "my-cache-key",
//	        "path": "/tmp/cache",
//	    },
//	}
type Step struct {
	ID    string            `yaml:"id"`
	Uses  string            `yaml:"uses"`
	With  map[string]string `yaml:"with"`
	Shell string            `yaml:"shell"`
	Run   string            `yaml:"run"`
	Env   map[string]string `yaml:"env"`
}

// String implements fmt.Stringer for Action
func (a Action) String() string {
	var b strings.Builder
	b.WriteString(a.ShortString())

	b.WriteString("\nRuns:\n")
	b.WriteString(indent(a.Runs.String(), 1))

	return b.String()
}

// ShortString implements fmt.Stringer for Action but with runs trimmed out
func (a Action) ShortString() string {
	var b strings.Builder
	b.WriteString(fmt.Sprintf("Name: %s\n", a.Name))
	b.WriteString(fmt.Sprintf("Description: %s\n", a.Description))
	b.WriteString(fmt.Sprintf("Author: %s\n", a.Author))

	b.WriteString("\nBranding:\n")
	b.WriteString(indent(a.Branding.String(), 1))

	b.WriteString("\nInputs:\n")
	b.WriteString(indent(a.Inputs.String(), 1))

	b.WriteString("\nOutputs:\n")
	b.WriteString(indent(a.Outputs.String(), 1))

	return b.String()
}

// String implements fmt.Stringer for Branding
func (b Branding) String() string {
	return fmt.Sprintf("Icon: %s\nColor: %s", b.Icon, b.Color)
}

// String implements fmt.Stringer for Inputs
func (i Inputs) String() string {
	var b strings.Builder
	for k, v := range i {
		b.WriteString(fmt.Sprintf("%s:\n", k))
		b.WriteString(indent(v.String(), 1))
	}
	return b.String()
}

// String implements fmt.Stringer for Input
func (i Input) String() string {
	var b strings.Builder
	b.WriteString(fmt.Sprintf("Description: %s\n", i.Description))
	b.WriteString(fmt.Sprintf("Required: %v\n", i.Required))
	b.WriteString(fmt.Sprintf("Default: %s", i.Default))
	if i.DeprecationMessage != "" {
		b.WriteString(fmt.Sprintf("\nDeprecation Message: %s", i.DeprecationMessage))
	}
	return b.String()
}

// String implements fmt.Stringer for Outputs
func (o Outputs) String() string {
	var b strings.Builder
	for k, v := range o {
		b.WriteString(fmt.Sprintf("%s:\n", k))
		b.WriteString(indent(v.String(), 1))
	}
	return b.String()
}

// String implements fmt.Stringer for Output
func (o Output) String() string {
	return fmt.Sprintf("Description: %s\nValue: %s", o.Description, o.Value)
}

// String implements fmt.Stringer for Runs
func (r Runs) String() string {
	var b strings.Builder
	b.WriteString(fmt.Sprintf("Using: %s\n", r.Using))

	b.WriteString("Environment:\n")
	for k, v := range r.Env {
		b.WriteString(indent(fmt.Sprintf("%s: %s\n", k, v), 1))
	}

	b.WriteString("Steps:\n")
	for _, step := range r.Steps {
		b.WriteString(indent(step.String()+"\n", 1))
	}

	return b.String()
}

// String implements fmt.Stringer for Step
func (s Step) String() string {
	var b strings.Builder
	if s.ID != "" {
		b.WriteString(fmt.Sprintf("ID: %s\n", s.ID))
	}
	if len(s.With) > 0 {
		b.WriteString("With:\n")
		for k, v := range s.With {
			b.WriteString(fmt.Sprintf("%s: %s\n", k, v))
		}
	}
	if s.Shell != "" {
		b.WriteString(fmt.Sprintf("Shell: %s\n", s.Shell))
	}
	if s.Run != "" {
		b.WriteString(fmt.Sprintf("Run:\n%s", indent(s.Run, 1)))
	}
	return strings.TrimSuffix(b.String(), "\n")
}

// indent adds the specified number of indentation levels to each line of the input string
func indent(s string, level int) string {
	if s == "" {
		return s
	}

	prefix := strings.Repeat(" ", level*parserIndentSize)
	lines := strings.Split(s, "\n")
	for i, line := range lines {
		if line != "" {
			lines[i] = prefix + line
		}
	}
	return strings.Join(lines, "\n") + "\n"
}

func Parse(yamlFilePath string) (Action, error) {
	// Read the action.yml file
	data, err := os.ReadFile(yamlFilePath)
	if err != nil {
		return Action{}, fmt.Errorf("Error reading %s: %v", yamlFilePath, err)
	}

	// Parse the YAML into our Action struct
	var action Action
	if err := yaml.Unmarshal(data, &action); err != nil {
		return Action{}, fmt.Errorf("Error parsing YAML: %v", err)
	}

	return action, nil
}
