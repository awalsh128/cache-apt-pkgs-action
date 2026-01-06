package actions

// NewCacheSaveAction creates a new cache save action with default configuration
func NewCacheSaveAction() *Action {
	return &Action{
		Name:        "Cache save",
		Description: "Save cache with key and path",
		Author:      "GitHub",
		Branding: Branding{
			Icon:  "archive",
			Color: "gray-dark",
		},
		Inputs: Inputs{
			"key": Input{
				Description: "An explicit key for a cache entry",
				Required:    true,
			},
			"path": Input{
				Description: "A list of files, directories, and wildcard patterns to cache",
				Required:    true,
			},
			"upload-chunk-size": Input{
				Description: "The chunk size used to split up large files during upload, in bytes",
				Required:    false,
			},
			"enableCrossOsArchive": Input{
				Description: "An optional boolean when enabled, allows Windows runners to save caches that can be restored on other platforms",
				Required:    false,
				Default:     "false",
			},
		},
		Outputs: Outputs{
			// Cache save action has no outputs according to the documentation
		},
		Runs: Runs{
			// Actual values for GitHub action.
			// Using: "node20",
			// Main:  "dist/save/index.js",
			Steps: []Step{
				{
					ID:   "Save cache",
					Uses: "actions/cache@v3",
					With: map[string]string{
						"key":  "${{ inputs.key }}",
						"path": "${{ inputs.path }}",
					},
					Shell: "bash",
					Run: `					
					mkdir -p /tmp/cache-apt-pkgs-action-test/${key}
					find ${path} -type f -exec cp --parents -r {} /tmp/cache-apt-pkgs-action-test/${key} \;
					echo "Cache saved to /tmp/cache-apt-pkgs-action-test/${key}"
					`,
				},
			},
		},
	}
}
