'use strict';

var fs = require('fs');
var angular = require('angular');
var moment = require('camunda-commons-ui/vendor/moment');

var jobsTemplate = fs.readFileSync(__dirname + '/jobs-tab.html', 'utf8');
var jobRescheduleTemplate = fs.readFileSync(__dirname + '/jobs-reschedule-modal.html', 'utf8');


var Configuration = function PluginConfiguration(ViewsProvider) {
  ViewsProvider.registerDefaultView('cockpit.processInstance.runtime.tab', {
    id: 'jobs-tab',
    label: 'PLUGIN_JOBS_LABEL',
    template: jobsTemplate,
    priority: 0,
    controller:  [
      '$scope', 'camAPI', 'Notifications', '$translate', '$uibModal',
      function($scope, camAPI, Notifications, $translate, $modal) {

        var jobProvider = camAPI.resource('job');
        var processInstance = $scope.processInstance;

        $scope.pages = {size: 50, total: 0, current: 1};
        $scope.options = {useJobCreationDate: true};

        $scope.onPaginationChange = function(pages) {
          $scope.pages.current = pages.current;
          updateView();
        };

        var updateView = function() {
          var page =  $scope.pages.current,
              count =  $scope.pages.size,
              firstResult = (page - 1) * count;
          
          var queryParams = {
            'processInstanceId': processInstance.id, 
            'timers': true,
            firstResult: firstResult,
            maxResults: count
          };

          //get 'count' of jobs
          jobProvider.count(queryParams, function(error, response) {
            $scope.pages.total = response;
          });

          //get current page and display it
          $scope.loadingState = 'LOADING';
          jobProvider.list(queryParams, jobCallback);
          
        }; 

        var jobCallback = function(err, res) {
          if(err) {
            Notifications.addError({
              status: $translate.instant('PLUGIN_JOBS'),
              message: $translate.instant('PLUGIN_JOBS_LOADING_ERROR')
            });
          } 
          else {
            $scope.loadingState = res.length ? 'LOADED' : 'EMPTY';
            $scope.jobs = res;
          }
        };

        var recalculateDate = function(job, useCreationDate) {
          jobProvider.recalculateDuedate({id: job.id, creationDateBased: useCreationDate}, function(err) {
            if(err) {
              Notifications.addError({
                status: $translate.instant('PLUGIN_JOBS_RECALCULATE_ERROR'),
                message: $translate.instant('PLUGIN_JOBS_RECALCULATE_ERROR_MESSAGE'),
                exclusive: true
              });
            } 
            else {
              Notifications.addMessage({
                status: $translate.instant('PLUGIN_JOBS_RECALCULATE_SUCCESS'),
                message: $translate.instant('PLUGIN_JOBS_RECALCULATE_SUCCESS_MESSAGE'),
                exclusive: true
              });
            }
          });
        };

        var setDuedate = function(job, date) {
          jobProvider.setDuedate({id: job.id, duedate: date}, function(err) {
            if(err) {
              Notifications.addError({
                status: $translate.instant('PLUGIN_JOBS_RECALCULATE_ERROR'),
                message: $translate.instant('PLUGIN_JOBS_SET_DUEDATE_ERROR_MESSAGE'),
                exclusive: true
              });
            }
            else {
              Notifications.addMessage({
                status: $translate.instant('PLUGIN_JOBS_RECALCULATE_SUCCESS'),
                message: $translate.instant('PLUGIN_JOBS_RSET_DUEDATE_SUCCESS_MESSAGE'),
                exclusive: true
              });
            }
          });
        };

        $scope.openRecalculationWindow = function(job) {
          $modal.open({
            controller: ['$scope', '$filter',
              function($scope, $filter) {
                $scope.recalculationType = 'specific';

                var dateFilter = $filter('date'),
                    dateFormat = 'yyyy-MM-dd\'T\'HH:mm:ss';

                $scope.date = dateFilter(Date.now(), dateFormat);
                $scope.submit = function() {
                  switch($scope.recalculationType) {
                  case 'specific':
                    setDuedate(job, moment($scope.date, moment.ISO_8601).format('YYYY-MM-DDTHH:mm:ss.SSSZZ'));
                    break;
                  case 'now':
                    recalculateDate(job, false);
                    break;
                  case 'creation':
                    recalculateDate(job, true);
                    break;
                  }
                };

                $scope.isValid = function() {
                  return ($scope.recalculationType === 'specific') ? (this.rescheduleJobDuedateForm.$valid) : true;
                };
              }],
            template: jobRescheduleTemplate
          }).result.catch(angular.noop);
        };

        $scope.loadingState = 'LOADING';
        
      }]
  });
};

Configuration.$inject = ['ViewsProvider'];

module.exports = Configuration;