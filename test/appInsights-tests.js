function convertTimeSpanToMS(timeSpan){

	var parts = timeSpan.split(':');

	var ms = 0;

	ms += parts[0] * 3600000;
	ms += parts[1] * 60000;
	ms += parts[2] * 1000;

	return ms;
}




describe('Application Insights for Angular JS Provider', function(){
	
	var _appInsightsUrl = 'https://dc.services.visualstudio.com/v2/track';
	var _insights;
	var $httpBackend;
	var $log;
	var $exceptionHandler;
	beforeEach( module('ApplicationInsightsModule', function(applicationInsightsServiceProvider){
    	applicationInsightsServiceProvider.configure('1234567890','angularjs-appinsights-unittests', false);

    }));

	beforeEach(inject(function(applicationInsightsService, $injector) { 
		_insights = applicationInsightsService;
		$httpBackend = $injector.get('$httpBackend');
		$log = $injector.get('$log');
		$log.reset();
		$exceptionHandler = $injector.get('$exceptionHandler');
	}));
 
 	afterEach(function(){

			$httpBackend.verifyNoOutstandingExpectation();
      		$httpBackend.verifyNoOutstandingRequest();
 	});

	describe('Configuration Settings', function(){

		it('Should remember the configured application name', function(){
      		expect(_insights.applicationName).toEqual('angularjs-appinsights-unittests');
    	});

    	it('Should remember that automatic pageview tracking is disabled for tests', function(){
    		expect(_insights.autoPageViewTracking).toEqual(false);
    	});
	});

	describe('Page view Tracking', function(){

		it('Sent data should match expectications',function(){

			$httpBackend.resetExpectations();
			$httpBackend.expect('POST','https://dc.services.visualstudio.com/v2/track',function(json){
				var data = JSON.parse(json);

				//expect(data.length).toEqual(1);
				expect(data.name).toEqual('Microsoft.ApplicationInsights.Pageview');
				expect(data.data.type).toEqual('Microsoft.ApplicationInsights.PageviewData');
				expect(data.data.item.ver).toEqual(1);
				expect(data.data.item.url).toEqual('http://www.somewhere.com/sometest/page');
				expect(data.data.item.properties.testprop).toEqual('testvalue');
				expect(data.data.item.measurements.metric1).toEqual(2345);


				return true;
			}, function(headers){
				expect(headers['Content-Type']).toEqual('application/json');				
				return headers['Content-Type'] == 'application/json';
			})
			.respond(200,'');


			_insights.trackPageView('/sometest/page','http://www.somewhere.com/sometest/page',{testprop:'testvalue'},{metric1:2345});
			$httpBackend.flush();
 
		});
	});

	describe('Log Message Tracking', function(){

		it('Sent data should match expectications',function(){

			$httpBackend.expectPOST('https://dc.services.visualstudio.com/v2/track',function(json){
				var data = JSON.parse(json);
				//expect(data.length).toEqual(1);
				expect(data.name).toEqual('Microsoft.ApplicationInsights.Message');

				return true;
			}, function(headers){				
				return headers['Content-Type'] == 'application/json';
			})
			.respond(200,'');

			_insights.trackTraceMessage('this is a trace Message.');
			$httpBackend.flush();
 
		});


		it('Should send data to application insights when messages are written via $log service',function(){
			$httpBackend.expectPOST('https://dc.services.visualstudio.com/v2/track',function(json){
				var data = JSON.parse(json);
				//expect(data.length).toEqual(1);
				expect(data.name).toEqual('Microsoft.ApplicationInsights.Message');
				expect(data.data.item.message).toEqual('this is a message written via the $log serice');

				return true;
			}, function(headers){				
				return headers['Content-Type'] == 'application/json';
			})
			.respond(200,'');

			$log.debug('this is a message written via the $log serice');
			$httpBackend.flush();
		}); 
	});

	describe('Custom Event Tracking', function(){

		it('Sent data should match expectications',function(){

			$httpBackend.expectPOST('https://dc.services.visualstudio.com/v2/track',function(json){
				var data = JSON.parse(json);
				//expect(data.length).toEqual(1);
				expect(data.name).toEqual('Microsoft.ApplicationInsights.Event');

				return true;
			}, function(headers){				
				return headers['Content-Type'] == 'application/json';
			})
			.respond(200,'');

			_insights.trackEvent('Some Test Event');
			$httpBackend.flush();
		});

		it('Timed events should have a duration value greater than 0',function(){
				$httpBackend.expectPOST('https://dc.services.visualstudio.com/v2/track',function(json){
				var data = JSON.parse(json);
				//expect(data.length).toEqual(1);
				expect(data.name).toEqual('Microsoft.ApplicationInsights.Event');
				
				var totalMs = convertTimeSpanToMS(data.data.item.duration);

				expect(totalMs).toBeGreaterThan(0);

				return true;
			}, function(headers){				
				return headers['Content-Type'] == 'application/json';
			})
			.respond(200,'');

			_insights.startTrackEvent('Some Test Event');
			//waste some time
			for(var x=0;x<10000000;x++)
			{}
			_insights.endTrackEvent('Some Test Event');
			$httpBackend.flush();


		});
	});

	describe('Custom Metric Tracking', function(){

		it('Sent data should match expectications',function(){

			$httpBackend.expectPOST('https://dc.services.visualstudio.com/v2/track',function(json){
				var data = JSON.parse(json);
				//expect(data.length).toEqual(1);
				expect(data.name).toEqual('Microsoft.ApplicationInsights.Metric');
				expect(data.data.item.properties.testProp).toEqual('testValue');
				expect(data.data.item.metrics[0].value).toEqual(2345);
				return true;
			}, function(headers){				
				return headers['Content-Type'] == 'application/json';
			})
			.respond(200,'');

			_insights.trackMetric('Test Metric', 2345, {testProp:'testValue'});
			$httpBackend.flush();
 
		});
	});

	describe('Exception/Crash Tracking', function(){

		it('Crashes should be sent to Application Insights',function(){

			$httpBackend.expectPOST('https://dc.services.visualstudio.com/v2/track',function(json){
				var data = JSON.parse(json);
				//expect(data.length).toEqual(1);

				expect(data.name).toEqual('Microsoft.ApplicationInsights.Exception');
				return true;
			}, function(headers){				
				return headers['Content-Type'] == 'application/json';
			})
			.respond(200,'');

			try
			{
				// cause an exception
			   1+z; // jshint ignore:line
			}
			catch(e){
				_insights.trackException(e);
			}

			$httpBackend.flush();
 
		});
	});

});