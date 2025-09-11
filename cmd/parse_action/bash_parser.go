package main

import (
	"fmt"
	"strings"

	"mvdan.cc/sh/v3/syntax"
)

// ParseBashToAST parses a bash script string into an AST
func ParseBashToAST(script string) (*syntax.File, error) {
	// Create a new parser with bash dialect
	parser := syntax.NewParser(syntax.KeepComments(true), syntax.Variant(syntax.LangBash))

	// Parse the script into an AST
	file, err := parser.Parse(strings.NewReader(script), "")
	if err != nil {
		return nil, fmt.Errorf("failed to parse bash script: %v", err)
	}

	return file, nil
}

// AnalyzeBashScript provides analysis of a bash script including variables, functions, and commands
func AnalyzeBashScript(script string) (map[string]interface{}, error) {
	file, err := ParseBashToAST(script)
	if err != nil {
		return nil, err
	}

	analysis := make(map[string]interface{})
	variables := make(map[string]struct{})
	functions := make([]string, 0)
	commands := make([]string, 0)

	// Walk the AST and collect information
	syntax.Walk(file, func(node syntax.Node) bool {
		switch n := node.(type) {
		case *syntax.Assign:
			// Found variable assignment
			if n.Name != nil {
				variables[n.Name.Value] = struct{}{}
			}
		case *syntax.FuncDecl:
			// Found function declaration
			if n.Name != nil {
				functions = append(functions, n.Name.Value)
			}
		case *syntax.CallExpr:
			// Found command execution
			if len(n.Args) > 0 {
				var cmd strings.Builder
				for _, part := range n.Args[0].Parts {
					if lit, ok := part.(*syntax.Lit); ok {
						cmd.WriteString(lit.Value)
					}
				}
				if cmd.Len() > 0 {
					commands = append(commands, cmd.String())
				}
			}
		}
		return true
	})

	// Convert variables map to slice for better JSON output
	varSlice := make([]string, 0, len(variables))
	for v := range variables {
		varSlice = append(varSlice, v)
	}

	analysis["variables"] = varSlice
	analysis["functions"] = functions
	analysis["commands"] = commands

	return analysis, nil
}

func ParseAndGetAst(action Action) (string, error) {
	converter := NewBashConverter(action)
	script := converter.Convert()

	// Analyze the generated script
	analysis, err := AnalyzeBashScript(script)
	if err != nil {
		return script, fmt.Errorf("script analysis error: %v", err)
	}

	// Add analysis as comments at the top of the script
	var finalScript strings.Builder
	finalScript.WriteString("#!/bin/bash\n\n")
	finalScript.WriteString("# Script Analysis:\n")
	finalScript.WriteString(fmt.Sprintf("# Variables: %v\n", analysis["variables"]))
	finalScript.WriteString(fmt.Sprintf("# Functions: %v\n", analysis["functions"]))
	finalScript.WriteString(fmt.Sprintf("# Commands: %v\n\n", analysis["commands"]))
	finalScript.WriteString(script)

	return finalScript.String(), nil
}
