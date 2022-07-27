
var editorTools = {
	"start": {
		"init" : function(self) {
			self.data = {orientation:180};
		},
		"resume" : function(self) {
			var $startPositions = document.createElementNS(SVG, "svg");
			$startPositions.setAttribute("x",-100);
			$startPositions.setAttribute("y",-100);
			self.state.startPositions = $startPositions;
			$editor.appendChild($startPositions);
			replaceStartPositions(self);
			document.getElementById("start-dir-selector").setValue(self.data.orientation+(self.data.mirror?"r":""));
			var data = deepCopy(self.data);
			delete self.data.pos;
			if (data.pos)
				self.click(self,data.pos,{});
		},
		"click" : function(self,point,extra) {
			if (!self.state.placed) {
				storeHistoryData(self.data);
				setPointPos(self.state.startPositions, {x:point.x-startCenterRotated.x,y:point.y-startCenterRotated.y});
				self.data.pos = point;
				self.state.startPositions.oncontextmenu = function(e) {
					showContextMenu(e,[{
						text: (language ? "Move":"Déplacer"),
						click: function() {
							storeHistoryData(self.data);
							delete self.data.pos;
							self.state.placed = false;
						}
					}]);
					return false;
				};
				self.state.placed = true;
			}
		},
		"move" : function(self,point,extra) {
			if (!self.state.placed)
				setPointPos(self.state.startPositions, {x:point.x-startCenterRotated.x,y:point.y-startCenterRotated.y});
		},
		"save" : function(self,payload) {
			payload.main.startposition = nullablePointToData(self.data.pos);
			if (self.data.pos) {
				var startShiftRotated = startShifts[self.data.orientation];
				payload.main.startposition[0] += startShiftRotated.x;
				payload.main.startposition[1] += startShiftRotated.y;
			}
			payload.main.startrotation = self.data.orientation;
			payload.main.startdirection = self.data.mirror ? 1:0;
		},
		"restore" : function(self,payload) {
			self.data.orientation = payload.main.startrotation;
			if (payload.main.startdirection) self.data.mirror = true;
			self.data.pos = dataToNullablePoint(payload.main.startposition);
			if (self.data.pos) {
				var startShiftRotated = startShifts[self.data.orientation];
				self.data.pos.x -= startShiftRotated.x;
				self.data.pos.y -= startShiftRotated.y;
			}
		},
		"rescale" : function(self, scale) {
			rescaleNullablePoint(self.data.pos, scale);
		},
		"rotate" : function(self, orientation) {
			rotateNullablePoint(self.data.pos, imgSize,orientation);
			self.data.orientation = (self.data.orientation + 360-orientation)%360;
		},
		"flip": function(self, axis) {
			flipNullablePoint(self.data.pos, imgSize,axis);
			self.data.mirror = !self.data.mirror;
			if (axis.coord == "y")
				self.data.orientation = (self.data.orientation + 180)%360;
		}
	},
	"aipoints": {
		"init" : function(self) {
			self.data = [{points:[],shortcuts:[],closed:false}];
			initRouteSelector(document.getElementById("traject"),1);
		},
		"resume" : function(self) {
			var traject = +document.getElementById("traject").value;
			var oldData = self.data[traject];
			initRouteBuilder(self,self.data,traject);
			self.shortcut.rebuild(self, oldData);
		},
		"shortcut": {
			"start": function(self, startPt) {
				var selfData = self.state.data;
				var selfPoints = selfData.points;
				self.shortcut.removeStarting(self, startPt);
			
				var mask = createMask();
				mask.classList.add("mask-dark");
				mask.close = function () { };
				for (var j=0;j<selfPoints.length;j++) {
					var bubbleR = 10;
					var screenCoords = getScreenCoords(selfPoints[j]);
					var bubble = createBubble(
						screenCoords.x,
						screenCoords.y,
						bubbleR
					);
					(function (j) {
						bubble.onclick = function (e) {
							e.stopPropagation();
							mask.defaultClose();
			
							storeHistoryData(self.data);
							self.shortcut.close(self, startPt, selfPoints[j]);
						};
					})(j);
					mask.appendChild(bubble);
				}
				mask.onmousemove = function (e) {
					var nX = e.pageX, nY = e.pageY;
					var nPoint = getEditorCoordsRounded({ x: nX, y: nY });
					movePolygonBuilder(self, nPoint);
				};
				mask.onclick = function (e) {
					var nX = e.pageX, nY = e.pageY;
					var nPoint = getEditorCoordsRounded({ x: nX, y: nY });
					self.shortcut.append(self, nPoint);
				};
				self.shortcut.init(self, startPt);
			},
			"init": function(self,startPt) {
				self.oldState = self.state;
				self.state = {
					data: {points:[],closed:false},
					point: self.state.point
				};
				startPolygonBuilder(self,startPt, {
					closed: false,
					custom_undos: true,
					keep_box: true
				});
			},
			"append": function(self, point) {
				appendRouteBuilder(self,point,{}, {
					allow_undos: false
				});
			},
			"close": function(self, startPt,endPt) {
				movePolygonBuilder(self,endPt);
				var autoInc = 0;
				var oldPoints = self.oldState.data.points;
				for (var i=0;i<oldPoints.length;i++) {
					if (oldPoints[i].id)
						autoInc = Math.max(autoInc,oldPoints[i].id);
				}
				if (!startPt.id)
					startPt.id = ++autoInc;
				if (!endPt.id)
					endPt.id = ++autoInc;
				var shortcutRoute = self.state.data.points;
				var shortcutNodes = self.state.nodes;
				for (var i=0;i<shortcutNodes.length;i++) {
					var node = shortcutNodes[i];
					$editor.removeChild(node.center);
					$editor.removeChild(node.circle);
				}
				var shortcutPoly = self.state.polygon;
				$editor.removeChild(shortcutPoly);
				if (startPt == endPt) {
					self.state = self.oldState;
					return;
				}
				shortcutPoly.classList.add("hover-toggle");
				shortcutPoly.style.strokeOpacity = 0.5;
				$editor.insertBefore(shortcutPoly,$editor.firstChild);
				addContextMenuEvent(shortcutPoly, [{
					text:(language ? "Edit":"Modifier"),
					click:function() {
						self.shortcut.start(self, startPt);
					}
				}, {
					text:(language ? "Delete":"Supprimer"),
					click:function() {
						self.shortcut.removeStarting(self, startPt);
					}
				}]);
				self.state = self.oldState;
				delete self.oldState;
				var selfData = self.state.data;
				selfData.shortcuts.push({
					start: startPt.id,
					end: endPt.id,
					route: shortcutRoute
				});
				self.state.shortcuts.push({
					start: startPt.id,
					remove: function() {
						$editor.removeChild(shortcutPoly);
					}
				});
			},
			"rebuild": function(self, oldData) {
				var oldPoints = oldData.points;
				var selfData = self.state.data;
				var selfPoints = selfData.points;
				var initRebuild = true;
				if (self.state.shortcuts) {
					initRebuild = false;
					for (var i=0;i<self.state.shortcuts.length;i++)
						self.state.shortcuts[i].remove();
				}
				self.state.shortcuts = [];
				selfData.shortcuts = [];
				for (var i=0;i<oldData.shortcuts.length;i++) {
					var shortcut = oldData.shortcuts[i];
					var startPointId = oldPoints.indexOf(oldPoints.find(function(pt) {
						return pt.id === shortcut.start;
					}));
					var endPointId = oldPoints.indexOf(oldPoints.find(function(pt) {
						return pt.id === shortcut.end;
					}));
					if ((startPointId != -1) && (endPointId != -1)) {
						self.shortcut.init(self, selfPoints[startPointId]);
						for (var j=0;j<shortcut.route.length;j++)
							self.shortcut.append(self, shortcut.route[j]);
						if (initRebuild)
							storeHistoryData(self.data);
						self.shortcut.close(self, selfPoints[startPointId],selfPoints[endPointId]);
					}
				}
			},
			"removeStarting": function(self, point) {
				self.state.shortcuts.forEach(function(s) {
					if (s.start === point.id)
						s.remove();
				});
				self.state.shortcuts = self.state.shortcuts.filter(function(s) {
					return s.start !== point.id;
				});
				var selfData = self.state.data;
				selfData.shortcuts = selfData.shortcuts.filter(function(s) {
					return s.start !== point.id;
				});
			}
		},
		"click" : function(self,point,extra) {
			appendRouteBuilder(self,point,extra, {
				ctxmenu: function(i) {
					return [{
						text: (language ? "Shortcut route":"Raccourci..."),
						title: (language ? "Alternate route the CPU will take if he has a mushroom item":"Route alternative lorsque l'ordi a un champignon"),
						click: function() {
							self.shortcut.start(self, self.state.data.points[i]);
						}
					}]
				},
				on_post_edit: function(self) {
					self.shortcut.rebuild(self, deepCopy(self.state.data));
				}
			});
		},
		"move" : function(self,point,extra) {
			moveRouteBuilder(self,point,extra);
		},
		"round_on_pixel" : function(self) {
			return true;
		},
		"save" : function(self,payload) {
			payload.main.aiclosed = [];
			payload.aipoints = [];
			for (var i=0;i<self.data.length;i++) {
				var iData = self.data[i];
				payload.main.aiclosed.push(iData.closed ? 1:0);
				payload.aipoints.push(polyToData(iData.points));
				if (iData.shortcuts.length) {
					var nShortcuts = {};
					if (!payload.aishortcuts) payload.aishortcuts = [];
					for (var j=0;j<iData.shortcuts.length;j++) {
						var iShortcut = iData.shortcuts[j];
						var startPointId = iData.points.indexOf(iData.points.find(function(pt) {
							return pt.id === iShortcut.start;
						}));
						var endPointId = iData.points.indexOf(iData.points.find(function(pt) {
							return pt.id === iShortcut.end;
						}));
						if ((startPointId != -1) && (endPointId != -1)) {
							nShortcuts[startPointId] = [
								polyToData(iShortcut.route),
								endPointId
							];
						}
					}
					payload.aishortcuts[i] = nShortcuts;
				}
			}
		},
		"restore" : function(self,payload) {
			currentMode = "aipoints";
			document.getElementById("traject-options").dataset.key = "aipoints";
			for (var i=1;i<payload.aipoints.length;i++)
				addTraject();
			document.getElementById("traject").selectedIndex = 0;
			for (var i=0;i<payload.aipoints.length;i++) {
				var shortcuts = [];
				var points = dataToPoly(payload.aipoints[i]);
				if (payload.aishortcuts && payload.aishortcuts[i]) {
					var aishortcuts = payload.aishortcuts[i];
					var autoInc = 0;
					for (var startPointId in aishortcuts) {
						var route = dataToPoly(aishortcuts[startPointId][0]);
						var endPointId = aishortcuts[startPointId][1];
						var startPt = points[startPointId];
						var endPt = points[endPointId];
						if (startPt && endPt) {
							if (!startPt.id) startPt.id = ++autoInc;
							if (!endPt.id) endPt.id = ++autoInc;
							shortcuts.push({
								start: startPt.id,
								end: endPt.id,
								route: route
							});
						}
					}
				}
				self.data[i] = {closed:payload.main.aiclosed[i]==1,shortcuts:shortcuts,points:points};
			}
		},
		"rescale" : function(self, scale) {
			for (var i=0;i<self.data.length;i++) {
				var iData = self.data[i];
				rescalePoly(iData.points, scale);
				if (iData.shortcuts) {
					for (var j=0;j<iData.shortcuts.length;j++)
						rescalePoly(iData.shortcuts[j].route, scale);
				}
			}
		},
		"rotate" : function(self, orientation) {
			for (var i=0;i<self.data.length;i++) {
				var iData = self.data[i];
				rotatePoly(iData.points, imgSize,orientation);
				if (iData.shortcuts) {
					for (var j=0;j<iData.shortcuts.length;j++)
						rotatePoly(iData.shortcuts[j].route, imgSize,orientation);
				}
			}
		},
		"flip" : function(self, axis) {
			for (var i=0;i<self.data.length;i++) {
				var iData = self.data[i];
				flipPoly(iData.points, imgSize,axis);
				if (iData.shortcuts) {
					for (var j=0;j<iData.shortcuts.length;j++)
						flipPoly(iData.shortcuts[j].route, imgSize,axis);
				}
			}
		}
	},
	"walls": commonTools["walls"],
	"offroad": commonTools["offroad"],
	"holes": commonTools["holes"],
	"checkpoints": {
		"init": function(self) {
			self.data = {
				"checkpoints": [],
				"type": 0,
				"nb": 3
			}
		},
		"resume" : function(self) {
			self.state.point = createRectangle({x:-1,y:-1});
			self.state.point.classList.add("noclick");
			self.state.rectangles = [];
			var data = self.data.checkpoints;
			self.data.checkpoints = [];
			for (var i=0;i<data.length;i++) {
				var iData = data[i];
				self.click(self,iData,{});
				var iRect = self.state.rectangle;
				self.click(self,{x:iData.x+iData.w,y:iData.y+iData.h},{});
				if (iData.theta) {
					self.data.checkpoints[i].theta = iData.theta;
					iRect.reposition(self.data.checkpoints[i]);
				}
				if (iData.optional)
					self.state.rectangles[i].toggleOptional();
			}
			updateLapsCounter();
		},
		"click" : function(self,point,extra) {
			if (self.state.rectangle)
				appendRectangleBuilder(self,point);
			else {
				if (!extra.oob) {
					startRectangleBuilder(self,point, {
						cp: true,
						on_apply: function(rectangle,data) {
							var selfData = self.data.checkpoints;
							selfData.push(data);
							var cpIdText = document.createElementNS(SVG, "text");
							cpIdText.setAttribute("class", "dark noclick");
							cpIdText.setAttribute("font-size", 15);
							cpIdText.setAttribute("text-anchor", "middle");
							cpIdText.setAttribute("dominant-baseline", "middle");
							self.state.rectangles.push(rectangle);
							function canBeOptional(iOrder) {
								if (self.data.type)
									return (iOrder < selfData.length-1) && (self.data.sections.indexOf(iOrder) == -1);
								return iOrder;
							}
							rectangle.reorder = function() {
								var nOrder = selfData.indexOf(data);
								cpIdText.innerHTML = 1+nOrder;
								if (data.optional && !canBeOptional(nOrder))
									this.toggleOptional();
							};
							rectangle.reposition = function(nData) {
								cpIdText.setAttribute("x", nData.x+nData.w/2);
								cpIdText.setAttribute("y", nData.y+nData.h/2+2);
								if (nData.theta) {
									rectangle.style.transform = "rotate("+nData.theta+"rad)";
									rectangle.style.transformOrigin = (nData.x + nData.w/2)+"px "+(nData.y + nData.h/2)+"px";
								}
								else
									rectangle.style.transform = "";
							};
							rectangle.toggleOptional = function() {
								if (data.optional) {
									delete data.optional;
									cpIdText.classList.remove("fade");
								}
								else {
									data.optional = true;
									cpIdText.classList.add("fade");
								}
							}
							rectangle.reorder();
							rectangle.reposition(data);
							$editor.appendChild(cpIdText);
							rectangle.oncontextmenu = function(e) {
								var optionalCheck = data.optional ? "✔ ":"";
								return showContextOnElt(e,rectangle, [{
									text: (language ? "Resize":"Redimensionner"),
									click: function() {
										rectangle.style.transform = "";
										resizeRectangle(rectangle,data,{cp:true, cap:"bounds", on_exit: function(nData) {
											rectangle.reposition(nData);
										}});
									}
								}, {
									text: (language ? "Move":"Déplacer"),
									click: function() {
										moveRectangle(rectangle,data,{cp:true,cap:"bounds"});
									}
								}, {
									text: (language ? "Change Order":"Changer ordre"),
									click: function() {
										var order = selfData.indexOf(data);
										var nOrder = prompt(language ? "Set new checkpoint position:":"Spécifier position du checkpoint :", 1+order)-1;
										if (nOrder!=order && nOrder>=0 && nOrder<selfData.length) {
											storeHistoryData(self.data);
											selfData.splice(order,1);
											selfData.splice(nOrder,0, data);
										}
										for (var i=0;i<self.state.rectangles.length;i++)
											self.state.rectangles[i].reorder();
									}
								}, {
									text: (language ? "Rotate":"Pivoter"),
									click: function() {
										rotateAngleRectangle(rectangle,data,{cp:true});
									}
								}, {
									text: optionalCheck + (language ? "Make optional":"Rendre optionel"),
									disabled: !canBeOptional(selfData.indexOf(data)),
									click: function() {
										storeHistoryData(self.data);
										rectangle.toggleOptional();
									}
								}, {
									text:(language ? "Delete":"Supprimer"),
									click:function() {
										$editor.removeChild(rectangle);
										$editor.removeChild(cpIdText);
										storeHistoryData(self.data);
										removeFromArray(selfData,data);
										removeFromArray(self.state.rectangles,rectangle);
										for (var i=0;i<self.state.rectangles.length;i++)
											self.state.rectangles[i].reorder();
									}
								}]);
							};
						}
					});
				}
			}
		},
		"move" : function(self,point,extra) {
			moveRectangleBuilder(self,point);
		},
		"save" : function(self,payload) {
			payload.checkpoint = [];
			var selfData = self.data.checkpoints;
			for (var i=0;i<selfData.length;i++) {
				var iData = selfData[i];
				var iPayload = [iData.x,iData.y,0,0];
				if (iData.h != 15) {
					iPayload[2] = iData.h;
					iPayload[3] = 0;
				}
				else {
					iPayload[2] = iData.w;
					iPayload[3] = 1;
				}
				if (iData.theta) {
					var u0 = 7.5, v0 = 7.5;
					var xO = iData.x + u0, yO = iData.y + v0;
					var xC = iData.x + iData.w/2, yC = iData.y + iData.h/2;
					var xCO = xO - xC, yCO = yO - yC;
					var cosTheta = Math.cos(iData.theta), sinTheta = Math.sin(iData.theta);
					var xR = xC + xCO*cosTheta + yCO*sinTheta;
					var yR = yC + yCO*cosTheta - xCO*sinTheta;
					iPayload[0] = xR - u0;
					iPayload[1] = yR - v0;
					iPayload[3] += iData.theta*2/Math.PI;
					iPayload[3] -= Math.floor(iPayload[3]/4)*4;
				}
				if (iData.optional)
					iPayload[4] = 1;
				payload.checkpoint.push(iPayload);
			}
			payload.main.tours = self.data.nb;
			if (self.data.type)
				payload.main.sections = self.data.sections;
		},
		"restore" : function(self,payload) {
			var selfData = self.data.checkpoints;
			for (var i=0;i<payload.checkpoint.length;i++) {
				var iPayload = payload.checkpoint[i];
				var iData = {x:iPayload[0],y:iPayload[1]};
				switch (iPayload[3]) {
				case 0:
					iData.w = 15;
					iData.h = iPayload[2];
					break;
				case 1:
					iData.w = iPayload[2];
					iData.h = 15;
					break;
				default:
					var actualTheta = iPayload[3]*Math.PI/2;
					var u0 = 7.5, v0 = 7.5;
					var cosTheta = Math.cos(actualTheta), sinTheta = Math.sin(actualTheta);
					var xR = iData.x + u0, yR = iData.y + v0;
					var yCR = iPayload[2]/2 - u0;
					var xC = xR + yCR*sinTheta, yC = yR + yCR*cosTheta;

					var rot = iPayload[3] + 0.5;
					if (rot-2*Math.floor(rot/2) < 1) {
						iData.w = 15;
						iData.h = iPayload[2];
					}
					else {
						iData.w = iPayload[2];
						iData.h = 15;
						actualTheta += Math.PI/2;
					}
					iData.x = xC - iData.w/2;
					iData.y = yC - iData.h/2;
					iData.theta = actualTheta;
				}
				if (iPayload[4])
					iData.optional = true;
				selfData.push(iData);
			}
			self.data.nb = payload.main.tours;
			if (payload.main.sections) {
				self.data.type = 1;
				self.data.sections = payload.main.sections;
			}
			else
				self.data.type = 0;
		},
		"rescale" : function(self, scale) {
			var plus = new Array();
			var iInfo = [];
			for (var j=0;j<self.data.checkpoints.length;j++) {
				var jInfo = rectToData(self.data.checkpoints[j]);
				if (jInfo[3] != 15) {
					jInfo[2] = jInfo[3];
					jInfo[3] = 0;
				}
				else
					jInfo[3] = 1;
				iInfo.push(jInfo);
			}
			var rapports = [scale.x, scale.y];
			var plus = new Array();
			for (var j=0;j<iInfo.length;j++) {
				plus[j] = [0,0];
				plus[j][iInfo[j][3]] = (iInfo[j][iInfo[j][3]] > iInfo[(j?j:iInfo.length)-1][iInfo[j][3]])*15;
			}
			for (var j=0;j<iInfo.length;j++) {
				for (var k=0;k<2;k++)
					iInfo[j][k] = Math.round((iInfo[j][k]+plus[j][k])*rapports[k]-plus[j][k]);
				iInfo[j][2] = Math.round(iInfo[j][2]*rapports[1-iInfo[j][3]]+rapports[1-iInfo[j][3]]-1);
			}
			for (var j=0;j<iInfo.length;j++) {
				var jInfo = iInfo[j];
				if (jInfo[3])
					jInfo[3] = 15;
				else {
					jInfo[3] = jInfo[2];
					jInfo[2] = 15;
				}
				self.data.checkpoints[j] = dataToRect(jInfo);
			}
		},
		"rotate" : function(self, orientation) {
			for (var i=0;i<self.data.checkpoints.length;i++)
				rotateRect(self.data.checkpoints[i], imgSize,orientation);
		},
		"flip" : function(self, axis) {
			for (var i=0;i<self.data.checkpoints.length;i++)
				flipRect(self.data.checkpoints[i], imgSize,axis);
		}
	},
	"items": commonTools["items"],
	"jumps": commonTools["jumps"],
	"boosts": commonTools["boosts"],
	"decor": commonTools["decor"],
	"cannons": commonTools["cannons"],
	"teleports": commonTools["teleports"],
	"mobiles": commonTools["mobiles"],
	"elevators": commonTools["elevators"],
	"options": commonTools["options"]
};

function rotateAngleRectangle(rectangle,data,options) {
	options = options||{};
	var mask = createMask();
	mask.classList.add("mask-dark");

	var screenCoords = getScreenCoords(data);
	var aX = screenCoords.x + screenCoords.w/2, aY = screenCoords.y + screenCoords.h/2;
	var nData = deepCopy(data);
	mask.classList.remove("mask-dark");
	function rotateRect(e) {
		var nX = e.pageX, nY = e.pageY;
		var diffX = nX-aX;
		var diffY = nY-aY;
		var angle = (data.h != 15) ? -Math.atan2(diffX,diffY) : Math.atan2(diffY,diffX);
		if (e.shiftKey)
			angle = Math.round(angle/Math.PI*2)*Math.PI/2;
		nData.theta = angle;
		rectangle.reposition(nData);
	}
	function stopRotateRect(e) {
		e.stopPropagation();
		$toolbox.classList.remove("hiddenbox");
		//rotateRect(e);
		storeHistoryData(editorTools[currentMode].data);
		if (options.on_end_move)
			options.on_end_move();
		var apply;
		if (options.on_apply)
			apply = options.on_apply(nData);
		if (false !== apply) {
			var nbQuarters = nData.theta * 2/Math.PI;
			var nbQuartersRound = Math.round(nbQuarters);
			if (Math.abs(nbQuarters-nbQuartersRound) < 1e-5) {
				nbQuartersRound = nbQuartersRound - Math.floor(nbQuartersRound/4)*4;
				delete data.theta;
				var xO = Math.round(data.w/2), yO = Math.round(data.h/2);
				var xC = data.x + xO, yC = data.y + yO;
				for (var i=0;i<nbQuartersRound;i++) {
					var nX = yO, nY = xO;
					var nW = data.h, nH = data.w;
					xO = nX;
					yO = nY;
					data.w = nW;
					data.h = nH;
				}
				data.x = Math.round(xC - xO);
				data.y = Math.round(yC - yO);
				rectangle.setAttribute("x", data.x);
				rectangle.setAttribute("y", data.y);
				rectangle.setAttribute("width", data.w+1);
				rectangle.setAttribute("height", data.h+1);
				rectangle.reposition(data);
			}
			else
				data.theta = nData.theta;
		}
		mask.removeEventListener("mousemove", rotateRect);
		mask.removeEventListener("mouseup", stopRotateRect);
		mask.defaultClose();
	}
	mask.addEventListener("mousemove", rotateRect);
	mask.addEventListener("mouseup", stopRotateRect);
	mask.close = function(){};
	$toolbox.classList.add("hiddenbox");
	if (options.on_start_move)
		options.on_start_move();
}