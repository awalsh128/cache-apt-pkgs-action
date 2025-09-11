package main

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

const indentSize = 2

// Action represents the GitHub Action configuration structure
type Action struct {
	Name        string   `yaml:"name"`
	Description string   `yaml:"description"`
	Author      string   `yaml:"author"`
	Branding    Branding `yaml:"branding"`
	Inputs      Inputs   `yaml:"inputs"`
	Outputs     Outputs  `yaml:"outputs"`
	Runs        Runs     `yaml:"runs"`
}

// Branding represents the action's branding configuration
type Branding struct {
	Icon  string `yaml:"icon"`
	Color string `yaml:"color"`
}

// Inputs represents all input parameters for the action
type Inputs struct {
	Packages              Input `yaml:"packages"`
	Version               Input `yaml:"version"`
	ExecuteInstallScripts Input `yaml:"execute_install_scripts"`
	Refresh               Input `yaml:"refresh"`
	Debug                 Input `yaml:"debug"`
}

// Input represents a single input parameter configuration
type Input struct {
	Description        string `yaml:"description"`
	Required           bool   `yaml:"required"`
	Default            string `yaml:"default"`
	DeprecationMessage string `yaml:"deprecationMessage,omitempty"`
}

// Outputs represents all output parameters from the action
type Outputs struct {
	CacheHit              Output `yaml:"cache-hit"`
	PackageVersionList    Output `yaml:"package-version-list"`
	AllPackageVersionList Output `yaml:"all-package-version-list"`
}

// Output represents a single output parameter configuration
type Output struct {
	Description string `yaml:"description"`
	Value       string `yaml:"value"`
}

// Runs represents the action's execution configuration
type Runs struct {
	Using string            `yaml:"using"`
	Env   map[string]string `yaml:"env"`
	Steps []Step            `yaml:"steps"`
}

// Step represents a single step in the action's execution
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

	b.WriteString("Packages:\n")
	b.WriteString(indent(i.Packages.String(), 1))

	b.WriteString("Version:\n")
	b.WriteString(indent(i.Version.String(), 1))

	b.WriteString("Execute Install Scripts:\n")
	b.WriteString(indent(i.ExecuteInstallScripts.String(), 1))

	b.WriteString("Refresh:\n")
	b.WriteString(indent(i.Refresh.String(), 1))

	b.WriteString("Debug:\n")
	b.WriteString(indent(i.Debug.String(), 1))

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

	b.WriteString("Cache Hit:\n")
	b.WriteString(indent(o.CacheHit.String(), 1))

	b.WriteString("Package Version List:\n")
	b.WriteString(indent(o.PackageVersionList.String(), 1))

	b.WriteString("All Package Version List:\n")
	b.WriteString(indent(o.AllPackageVersionList.String(), 1))

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

	prefix := strings.Repeat(" ", level*indentSize)
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
