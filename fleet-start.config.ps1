# Per-repo fleet start config for multi-gpu-cluster-recipes
# Edit ports/backend target here - start.ps1 is fleet-standard.
@{
    Name         = 'multi-gpu-cluster-recipes'
    BackendPort  = 11136
    FrontendPort = 0
    HealthPath   = '/health'
    WebRoot      = '.'
    Backend = @{
        # Docs/recipe repo: no Python backend exists. The Docusaurus site
        # (website/, :11136) is served via the repo's own start.ps1 / funnel,
        # not the fleet engine - so there is nothing to launch here.
        Kind = 'none'
    }
    Frontend = @{
        Kind = 'none'
    }
}
