#!/usr/bin/env node

/*!
 * Example processing worker.
 */

'use strict';

const kue = require('kue'),
      queue = kue.createQueue();

/**
 * Transaction Machine instance.
 *
 * @type {exports|TransactionMachine}
 */
const processing = require('./lib/processing'),
      Account = processing.Account,
      Failure = processing.Failure;

/**
 * Balancer (account extension class).
 *
 * @type {Balancer|exports}
 */
const Balancer = require('./accounts/balancer');

/**
 * Register a job processor function.
 *
 * @param {string} type - job type
 * @param {function} fn - processing function
 */
function worker(type, fn) {
  queue.process(type, (job, done) => {
    process.stdout.write(`processing "${type}"...`); // >>>
    fn(job, function (err) {
      if (err) {
        console.log(' [failed]'); // >>>
        console.error(err.toString()); // >>>

        if (!(err instanceof Failure)) {
          let args = arguments;
          return job.attempts(0).save((e) => {
            if (e) {
              console.error(e, '`job.save()` failed!'); // >>>
            }

            done.apply(null, args);
          });
        }
      }
      else {
        console.log(' [completed]'); // >>>
      }

      done.apply(null, arguments);
    });
  });
}

/**
 * Create account process.
 *
 * @see ./cli/create-account.js
 */
worker('create_account', (job, done) => {
  Account.create(job.data)
    .then(account => done(null, account.toObject()))
    .catch(err => done(err));
});

/**
 * Get account process.
 *
 * @see ./cli/get-account.js
 */
worker('get_account', (job, done) => {
  Account.get(job.data)
    .then(account => done(null, (account ? account.toObject() : null)))
    .catch(err => done(err));
});

/**
 * Update account process.
 *
 * @see ./cli/update-account.js
 */
worker('update_account', (job, done) => {
  Account.get(job.data.query)
    .then(account => {
      if (!account) {
        return done(new Error('unable to get account by query ' + JSON.stringify(job.data.query)));
      }

      account.update(job.data.$set, (err) => {
        if (err) {
          return done(err);
        }

        done(null, account.toObject());
      });
    })
    .catch(err => done(err));
});

console.log('transaction machine worker is started and listening for a queue jobs...'); // >>>
