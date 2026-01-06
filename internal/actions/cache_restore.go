package actions

// NewCacheRestoreAction creates a new cache restore action with default configuration
func NewCacheRestoreAction() *Action {
	return &Action{
		Name:        "Cache restore",
		Description: "Restore cache without saving it",
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
				Description: "A list of files, directories, and wildcard patterns to restore",
				Required:    true,
			},
			"restore-keys": Input{
				Description: "An ordered list of prefix-matched keys to use for restoring stale cache if no cache hit occurred for key",
				Required:    false,
			},
			"fail-on-cache-miss": Input{
				Description: "Fail the workflow if cache entry is not found",
				Required:    false,
				Default:     "false",
			},
			"lookup-only": Input{
				Description: "If true, only checks if cache entry exists and skips download",
				Required:    false,
				Default:     "false",
			},
			"enableCrossOsArchive": Input{
				Description: "An optional boolean when enabled, allows Windows runners to restore caches from other platforms",
				Required:    false,
				Default:     "false",
			},
		},
		Outputs: Outputs{
			"cache-hit": Output{
				Description: "A boolean value to indicate an exact match was found for the key",
			},
			"cache-primary-key": Output{
				Description: "Cache primary key passed in the input to use in subsequent steps of the workflow",
			},
			"cache-matched-key": Output{
				Description: "Key of the cache that was restored, it could either be the primary key on cache-hit or a partial/complete match of one of the restore keys",
			},
		},
		Runs: Runs{
			// Actual values for GitHub action.
			// Using: "node20",
			// Main:  "dist/restore/index.js",
			Steps: []Step{
				{
					ID:   "Restore cache",
					Uses: "actions/cache@v3",
					With: map[string]string{
						"key":          "${{ inputs.key }}",
						"restore-keys": "${{ inputs.restore-keys }}",
						"path":         "${{ inputs.path }}",
					},
					Shell: "bash",
					Run: `
					if [ "${{ inputs.lookup-only }}" = "true" ]; then
					  echo "Lookup only mode enabled. Skipping cache restore."
					  exit 0
					fi

					CACHE_DIR="/tmp/cache-apt-pkgs-action-test"
					mkdir -p "$CACHE_DIR"

					if [ -d "$CACHE_DIR/${{ inputs.key }}" ]; then
					  echo "Cache hit for key '${{ inputs.key }}'. Restoring cache..."
					  find "$CACHE_DIR/${{ inputs.key }}" -type f -exec cp --parents -r {} ./ \;
					  echo "Cache restored from $CACHE_DIR/${{ inputs.key }}"
					  echo "cache-hit=true" >> $GITHUB_OUTPUT
					  echo "cache-primary-key=${{ inputs.key }}" >> $GITHUB_OUTPUT
					  echo "cache-matched-key=${{ inputs.key }}" >> $GITHUB_OUTPUT
					else
					  if [ -n "${{ inputs.restore-keys }}" ]; then
					    IFS=',' read -ra RESTORE_KEYS <<< "${{ inputs.restore-keys }}"
					    for KEY in "${RESTORE_KEYS[@]}"; do
					      if [ -d "$CACHE_DIR/$KEY" ]; then
					        echo "Partial cache hit for restore key '$KEY'. Restoring cache..."
					        find "$CACHE_DIR/$KEY" -type f -exec cp --parents -r {} ./ \;
					        echo "Cache restored from $CACHE_DIR/$KEY"
					        echo "cache-hit=false" >> $GITHUB_OUTPUT
					        echo "cache-primary-key=${{ inputs.key }}" >> $GITHUB_OUTPUT
					        echo "cache-matched-key=$KEY" >> $GITHUB_OUTPUT
					        exit 0
					      fi
					    done
					  fi
					  echo "No cache found for key '${{ inputs.key }}' or restore keys. Continuing without cache."
					  echo "cache-hit=false" >> $GITHUB_OUTPUT
					  echo "cache-primary-key=${{ inputs.key }}" >> $GITHUB_OUTPUT
					  echo "cache-matched-key=" >> $GITHUB_OUTPUT

					  if [ "${{ inputs.fail-on-cache-miss }}" = "true" ]; then
					    echo "Cache miss and 'fail-on-cache-miss' is set to true. Failing the workflow."
					    exit 1
					  fi
					fi
					`,
				},
			},
		},
	}
}
