# cache-apt-pkgs-action - Development

To develop and run tests you will need to setup your system.

## Environment

1. The project requires Go 1.23 or later.
2. Set GO111MODULE to auto:

```bash
# One-time setup
go env -w GO111MODULE=auto

# Or use the provided setup script
./scripts/setup_dev.sh
```

3. The project includes a `.env` file with required settings.

## Action Testing

