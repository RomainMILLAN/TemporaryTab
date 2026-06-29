.DEFAULT_GOAL = help
SHELL:=/bin/bash

CURRENT_VERSION := $(shell node -p "require('./package.json').version" 2>/dev/null)

.PHONY: help
help:
	@grep -E '(^([a-zA-Z_-]+ ?)+:.*?##.*$$)|(^##)' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[32m%-30s\033[0m %s\n", $$1, $$2}' | sed -e 's/\[32m##/[33m/'

##
## —— Version 🔖 ————————————————
.PHONY: bump
bump: ## Bump la version (package.json + manifest), ex: make bump VERSION=1.0.1
	@if [ -z "$(VERSION)" ]; then echo "Usage: make bump VERSION=x.y.z (version actuelle: $(CURRENT_VERSION))"; exit 1; fi
	@sed -i -E 's/("version": ")[^"]*(")/\1$(VERSION)\2/' package.json src/manifest.json
	@echo "🔖 Version: $(CURRENT_VERSION) → $(VERSION)"

.PHONY: tag
tag: ## Crée le tag git de la version courante (déclenche la release CI)
	@git tag v$(CURRENT_VERSION)
	@echo "🏷️  Tag v$(CURRENT_VERSION) créé. Pousse-le: git push origin v$(CURRENT_VERSION)"

##
## —— Build 📦 ————————————————
.PHONY: install
install: ## Installe les dépendances (web-ext)
	@npm ci

.PHONY: icons
icons: ## Régénère les icônes Ghost Tab
	@npm run icons

.PHONY: lint
lint: ## Valide le manifest (addons-linter)
	@npm run lint

.PHONY: build
build: ## Build les paquets Chrome + Firefox
	@npm run build:chrome
	@npm run build:firefox

.PHONY: sign-firefox
sign-firefox: ## Signe le .xpi Firefox via AMO (requiert WEB_EXT_API_KEY / WEB_EXT_API_SECRET)
	@npm run sign:firefox

.PHONY: clean
clean: ## Supprime les dossiers générés
	@rm -rf build web-ext-artifacts
	@echo "🧹 build/ et web-ext-artifacts/ supprimés"
