'use strict';
const async = require('async');
const hoek = require('hoek');
const BaseModel = require('./base');
const PipelineModel = require('./pipeline');
const JobModel = require('./job');

/**
 * Given a Job ID, look up the associated Pipeline ID
 *
 * @method fetchJob
 * @param  {Object}        datastore The datastore object that can retrieve the data from the datastore
 * @param  {String}        jobId     The ID of the job to look at
 * @param  {Function}      callback  fn(err, result), where result is a Job object
 */
function fetchJob(datastore, jobId, callback) {
    const jobModel = new JobModel(datastore);

    jobModel.get(jobId, callback);
}

/**
 * Given a Pipeline ID, look up the associated SCM Url
 *
 * @method fetchScmUrl
 * @param  {Object}    datastore          The datastore object that can retrieve the data from the datastore
 * @param  {Object}    params             An object
 * @param  {String}    params.pipelineId  The ID of the pipeline to look at
 * @param  {String}    params.name        The name of the job we are building
 * @param  {Function}  callback           fn(err, result), where result is an object consisting of two
 *                                        keys: "pipelineID", "scmUrl", and "jobName"
 */
function fetchScmUrl(datastore, params, callback) {
    const pipelineModel = new PipelineModel(datastore);
    const pipelineId = params.pipelineId;
    const jobName = params.name;

    pipelineModel.get(pipelineId, (err, data) => {
        if (err) {
            return callback(err);
        }

        return callback(null, {
            pipelineId,
            jobName,
            scmUrl: data.scmUrl
        });
    });
}

class BuildModel extends BaseModel {
    /**
     * Construct a BuildModel object
     * @method constructor
     * @param  {Object}    datastore         Object that will perform operations on the datastore
     * @param  {Object}    executor          Object that will perform executor operations
     */
    constructor(datastore, executor) {
        super('build', datastore);
        this.executor = executor;
    }

    /**
     * Create & start a new build
     * @method create
     * @param  {Object}   config                Config object
     * @param  {String}   config.jobId          The ID of the associated job to start
     * @param  {String}   [config.container]    The kind of container to use
     * @param  {Function} callback              fn(err, data) where data is the newly created object
     */
    create(config, callback) {
        const container = config.container || 'node:4';
        const jobId = config.jobId;
        const now = Date.now();
        const id = this.generateId({
            jobId,
            number: now
        });
        const initialBuildData = {
            cause: 'Started by user',
            container,
            jobId,
            createTime: now,
            number: now,
            status: 'QUEUED'
        };

        async.waterfall([
            (next) => {
                this.datastore.save({
                    table: this.table,
                    params: {
                        id,
                        data: initialBuildData
                    }
                }, (err) => {
                    next(err);
                });
            },
            async.apply(fetchJob, this.datastore, jobId),
            async.apply(fetchScmUrl, this.datastore)
        ], (err, data) => {
            if (err) {
                return callback(err);
            }

            return this.executor.start({
                buildId: id,
                container,
                jobId,
                jobName: data.jobName,
                pipelineId: data.pipelineId,
                scmUrl: data.scmUrl
            }, (executorErr) => {
                if (executorErr) {
                    return callback(executorErr);
                }

                return callback(null, hoek.applyToDefaults({ id }, initialBuildData));
            });
        });
    }

    /**
     * Gets all the builds for a jobId
     * @method getBuildsForJobId
     * @param  {Object}   config                Config object
     * @param  {String}   config.jobId          The jobId of the build to filter for
     * @param  {Function} callback         The callback object to return the stream to
     */
    getBuildsForJobId(config, callback) {
        const listConfig = {
            params: {
                jobId: config.jobId
            },
            paginate: {
                count: 25, // This limit is set by the matrix restriction
                page: 1
            }
        };

        this.list(listConfig, (err, records) => {
            if (err) {
                return callback(err);
            }
            records.sort((build1, build2) => build1.number - build2.number);

            return callback(null, records);
        });
    }

    /**
     * Stream a build
     * @method stream
     * @param  {Object}   config           Config object
     * @param  {String}   config.buildId   The id of the build to stream
     * @param  {Function} callback         The callback object to return the stream to
     */
    stream(config, callback) {
        return this.executor.stream(config, callback);
    }
}

module.exports = BuildModel;