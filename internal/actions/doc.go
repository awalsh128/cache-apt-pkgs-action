// Package actions provides data structures for GitHub Actions configurations
// and factory functions for creating pre-configured cache actions.
//
// This package defines the structure of GitHub Actions (action.yml format) and provides some action
// templates for external action dependencies. At this point it is very minimal and just used by the
// cache-apt-pkgs-action.
//
// # YAML Parsing
//
// Actions can be loaded from YAML files:
//
//	action := &Action{}
//	err := action.LoadFromFile("action.yml")
//	if err != nil {
//	    log.Fatal(err)
//	}
//
// Or parsed from YAML data:
//
//	yamlData := []byte(`
//	name: My Action
//	description: Does something useful
//	inputs:
//	  key:
//	    description: Cache key
//	    required: true
//	`)
//
//	action := &Action{}
//	err := yaml.Unmarshal(yamlData, action)
//
// # Usage Examples
//
// Accessing action metadata:
//
//	action := NewCacheRestoreAction()
//	fmt.Println(action.Name)        // "Cache restore"
//	fmt.Println(action.Description) // "Restore cache without saving it"
//	fmt.Println(action.Author)      // "GitHub"
//
// Working with inputs:
//
//	keyInput := action.Inputs["key"]
//	fmt.Println(keyInput.Required)    // true
//	fmt.Println(keyInput.Description) // "An explicit key for a cache entry"
//
//	// Check if input has a default value
//	lookupInput := action.Inputs["lookup-only"]
//	if lookupInput.Default != "" {
//	    fmt.Println("Default:", lookupInput.Default) // "false"
//	}
//
// Examining outputs:
//
//	cacheHitOutput := action.Outputs["cache-hit"]
//	fmt.Println(cacheHitOutput.Description)
//
// # Integration
//
// This package is designed to be used by the parent action2sh package for
// converting GitHub Actions to bash scripts. The action structures provide
// the metadata needed for script generation and validation.
//
// # Compatibility
//
// Action definitions are compatible with:
//   - GitHub Actions specification (action.yml format)
//
// All YAML tags follow GitHub Actions conventions for proper serialization.
package actions
