/*
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements.  See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership.  The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance
 with the License.  You may obtain a copy of the License at
 
 http://www.apache.org/licenses/LICENSE-2.0
 
 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
 */


#import "ChromeAppPlugin.h"
#import "Cordova/CDV.h"

@implementation ChromeAppPlugin

- (void)getManifestJson:(CDVInvokedUrlCommand*)command
{
    NSString* manifestPath = [[NSBundle mainBundle] pathForResource:@"manifest" ofType:@"json" inDirectory:@"www"];
    NSString* json = [NSString stringWithContentsOfFile:manifestPath encoding:NSUTF8StringEncoding error:nil];
    id jsonObj = [json cdvjk_objectFromJSONString];
    CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsDictionary:jsonObj];
    [self success:pluginResult callbackId:command.callbackId];
}

@end
