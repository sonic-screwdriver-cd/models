'use strict';

const BaseFactory = require('./baseFactory');
const CommandTag = require('./commandTag');
let instance;
const COMMAND_NAME_REGEX = schema.config.regex.FULL_COMMAND_NAME;

class CommandTagFactory extends BaseFactory {
    /**
     * Construct a CommandTagFactory object
     * @method constructor
     * @param  {Object}     config
     * @param  {Datastore}  config.datastore     Object that will perform operations on the datastore
     */
    constructor(config) {
        super('commandTag', config);
    }

    /**
     * Instantiate a CommandTag class
     * @method createClass
     * @param  {Object}     config               Command tag data
     * @param  {Datastore}  config.datastore     Object that will perform operations on the datastore
     * @param  {String}     config.namespace     The command namespace
     * @param  {String}     config.name          The command name
     * @param  {String}     config.tag           The command tag (e.g.: 'stable' or 'latest')
     * @param  {String}     config.version       Version of the command
     * @return {CommandTag}
     */
    createClass(config) {
        return new CommandTag(config);
    }

    /**
     * Parses a full command name and returns command object consisting of
     * Command name and namespace
     * @method _getNameAndNamespace
     * @param  {String} fullCommandName Full Command name (e.g.: chefdk/knife@1.2.3 or chefdk/knife@stable)
     * @return {Promise}                 Object with Command metadata
     */
     _getNameAndNamespace(fullCommandName) {
        const [, namespace, name] = COMMAND_NAME_REGEX.exec(fullCommandName);
        const parsedCommand = {};

        // Check if Command with namespace and name exist, default to using that Command
        return super
            .list({
                params: {
                    namespace,
                    name
                }
            })
            .then(namespaceExists => {
                if (namespaceExists.length > 0) {
                    parsedCommand.namespace = namespace;
                    parsedCommand.name = name;
                }

                return parsedCommand;
            });
    }

    /**
     * Get an instance of the CommandTagFactory
     * @method getInstance
     * @param  {Object}     config
     * @param  {Datastore}  config.datastore
     * @return {CommandTagFactory}
     */
    static getInstance(config) {
        instance = BaseFactory.getInstance(CommandTagFactory, instance, config);

        return instance;
    }

    /**
     * Create a new command tag for a given version
     * @method create
     * @param  {Object}     config
     * @param  {String}     config.name         The command name
     * @param  {String}     config.namespace    The command namespace
     * @param  {String}     config.tag          The command tag
     * @param  {String}     config.version      The command version
     * @return {Promise}
     */
    create(config) {
        config.createTime = new Date().toISOString();

        return super.create(config);
    }

    /**
     * Get a command tag
     * @method get
     * @param  {Mixed}    config
     * @param  {String}   [config.name]      Command name (may or may not contain namespace)
     * @param  {String}   [config.namespace] Command namespace
     * @param  {String}   [config.tag]       Command tag
     * @return {Promise}
     */
     get(config) {
        if (config.name && !config.namespace) {
            // eslint-disable-next-line no-underscore-dangle
            return this._getNameAndNamespace(config.name).then(parsedCommandName => {
                const { namespace, name } = parsedCommandName;

                config.namespace = namespace || null;
                config.name = name;

                return super.get(config);
            });
        }

        return super.get(config);
    }
}

module.exports = CommandTagFactory;
