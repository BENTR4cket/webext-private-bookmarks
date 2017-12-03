(function()
{
    /// Set in define().
    let configuration, storage, version;

    /// Opens a new tab displaying the release notes for the current version.
    function show_release_notes()
    {
        browser.tabs.create({ url: version.RELEASE_NOTES.url, active: true });
    }

    /// The key in local storage for an object indicating what type of deployment this release was
    /// part of (install/update). The object pointed to exists only up until the first user
    /// interaction with the extension proceeding deployment.
    const DEPLOYMENT_TYPE_STORAGE_KEY = "deployment";
    /// Executes one-time procedures during first user interaction with the current release.
    async function on_first_interaction(deployment_type)
    {
        if (deployment_type !== "update") { return; }

        const options = await configuration.load();

        if (options.do_show_release_notes &&
            version.RELEASE_NOTES.is_relevant_to_users)
        {
            show_release_notes();
        }
    }
    /// Listens for first user interaction with the extension proceeding deployment.
    async function listen_for_first_interaction(deployment_type)
    {
        /// Inspects the specified runtime message to determine whether it counts as an initial
        /// user interaction with the extension.
        function check(message)
        {
            if (message.type === "options-open" ||
                message.type === "popup-open")
            {
                browser.runtime.onMessage.removeListener(check);
                storage.remove(DEPLOYMENT_TYPE_STORAGE_KEY);
                on_first_interaction(deployment_type);
            }
        }
        browser.runtime.onMessage.addListener(check);
    }

    /// Handles extension deployment (installation and updates).
    async function on_deploy(details)
    {
        const deployment_type = details.reason;
        
        if      (deployment_type === "install") { on_install(); }
        else if (deployment_type === "update")  { on_update();  }

        await storage.save(DEPLOYMENT_TYPE_STORAGE_KEY, deployment_type);
        listen_for_first_interaction(deployment_type);
    }
    /// Handles extension installation.
    function on_install() { configuration.save(configuration.create()); }
    /// Handles extension update.
    function on_update()
    {
        configuration.load().then(options =>
        {
            configuration.save(configuration.update(options));
        });
    }

    /// Initializes this module.
    async function initialize()
    {
        const deployment_type = await storage.load(DEPLOYMENT_TYPE_STORAGE_KEY);
        if (deployment_type !== null)
        {
            listen_for_first_interaction(deployment_type);
        }
    }

    define(["scripts/meta/configuration",
            "scripts/meta/version",
            "scripts/utilities/local_storage"],
           (configuration_module, version_module, storage_module) =>
           {
                configuration = configuration_module;
                version = version_module;
                storage = storage_module;

                initialize();

                return { on_deploy: on_deploy };
           });
})();
