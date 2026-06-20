# Infrastructure Makefile

.PHONY: help

help:
	@echo "Available commands:"
	@echo "  help      Show this help message"

# Note: Vector DB migrations are now handled programmatically 
# via the AuthOnboardingService during tenant signup.
