var scats = (function(vis) {

	/**
	 * @class Renderer
	 * @classDesc The visualization's rendering component
	 * @memberOf scats
	 *
	 * @property {object} settings - The default setting values
	 * @property {object} settings.canvas - The default settings for our canvas
	 * @property {object} settings.canvas.margin - The default settings for our canvas
	 * @property {int} max_sets_per_group - The max number of sets per row
	 * @property {int} no_set_groups - The number of set groups in the layout
	 * @property {array} aggregated_bin_data - The data aggregated by bins
	 * @property {object} scales - A scales object
	 * @property {d3.scale} scales.x - The x scale used for the visualization
	 * @property {d3.scale} scales.y - The y scale used for the visualization
	 * @property {d3.scale} scales.color - The color scale used for coloring aggregates and sets based on the number of elements
	 * @property {d3.scale} scales.radianToPercent - The scale for converting percentage to radians
	 * @property {array} sortedValues - An array of unique values (elements per aggregate and elements per set) sorted ascending
	 * @property {subset} selectedSubset  - The currently selected subset.
	 * @property {table} table - The table object that shows the active selection
	 * @property {array} data_y_axis - A two-dimensional array. First dimension are the bins, second dimension the degrees per bin.
	 * @property {tooltip} tooltip - The tooltip object.
	 */
	function Renderer() {
		this.settings = {
			canvas: {
				margin: {
					top: 60,
					right: 80,
					bottom: 10,
					left: 80
				},
				width: 900,
				height: 700
			},
			set: {
				margin: { right: 2 },
				width: 16,
				height: 16,
				stroke: 1
			},
			subset: {
				r: 6
			},
			colors: colorbrewer.Oranges[9],
			labelButton: {
				width: 14,
				height: 14,
				rx: 5,
				ry: 5,
				margin: {
					right: 4,
					left: 4
				}
			}
		};
		this.max_sets_per_group = 0;
		this.no_set_groups = 0;
		this.aggregated_bin_data = [];
		this.scales = {
			x: undefined,
			y: undefined,
			color: undefined,
			radianToPercent: d3.scale.linear().domain([0, 100]).range([0, 2 * Math.PI])
		};
		this.sortedValues = [];
		this.selectedSubset = undefined;
		this.table = undefined;
		this.tooltip = undefined;
		this.data_y_axis = [];
		this.init();
	}

	Renderer.prototype = {
		/**
		 * Initializes the Renderer, i.e., common place for calling initialization tasks.
		 *
		 * @memberOf scats.Renderer
		 * @method init
		 */
		init: function() {
			var self = this;

			//check if data exists
			if (vis.data.grid.length == 0) {
				console.error("no grid data");
				return;
			}

			this.computeWidth();

			//this.data = new vis.Parser().helpers.transpose(vis.data.grid);
			//this.data = vis.data.fullGrid;
			this.max_sets_per_group = Math.ceil(this.settings.canvas.width / this.getTotalSetWidth());

			this.binningView = new vis.BinningView({
				setRenderer: this,
				container: "#binningViewModal"
			});

			this.aggregated_bin_data = vis.helpers.createAggregatedData(vis.data.bins.data);

			this.sortedValues = vis.helpers.computeSortedValuesArray(vis.data.elements, vis.data.aggregates);

			//sets y axis data
			this.data_y_axis = this.createYAxisLabelData();

			this.setupControls();

			initScales();

			this.setupLegend();

			//initialize table
			this.table = new vis.Table({ container: "#element-table", tableClass: "table table-bordered" });

			//initialize tooltip
			this.tooltip = new vis.Tooltip({
				container: "#tooltip"
			});

			function initScales() {
				self.scales.x = d3.scale.ordinal()
					.rangeBands([0, self.settings.canvas.width])
					.domain(d3.range(self.max_sets_per_group));

				self.scales.y = d3.scale.ordinal()
					.rangeBands([0, self.getSetInnerHeight()])
					.domain(d3.range(vis.data.bins.k));

				/*
				self.scales.color = d3.scale.linear()
					.domain([vis.data.min, vis.data.max])
					.range([0, self.settings.colors.length - 1]);
				*/

				/*
				self.scales.color = d3.scale.quantize()
					.domain([vis.data.min, vis.data.max])
					.range(self.settings.colors);
				*/


				/*
				 * see more about color scales:
				 * http://bl.ocks.org/mbostock/4573883
				 * http://stackoverflow.com/questions/19258996/what-is-the-difference-between-d3-scale-quantize-and-d3-scale-quantile
				 * http://stackoverflow.com/questions/17671252/d3-create-a-continous-color-scale-with-many-strings-inputs-for-the-range-and-dy

				 * http://stackoverflow.com/questions/10579944/how-does-d3-scale-quantile-work (!!)
				 * example: http://jsfiddle.net/euSfG/2/
				 */
				self.scales.color = d3.scale.quantile()
					.domain(self.sortedValues)
					.range(self.settings.colors);

			}

			return this;
		},
		/**
		 * Computes the available width of the canvas
		 *
		 * @memberOf scats.Renderer
		 * @method computeWidth
		 */
		computeWidth: function() {
			var $container = $(".ui-layout-center"),
				containerWidth = $container.width(),
				padding = {
					left: parseInt($container.css("padding-left").replace("px", "")),
					right: parseInt($container.css("padding-right").replace("px", ""))
				};

			this.settings.canvas.width = containerWidth - this.settings.canvas.margin.left + padding.left + padding.right;
		},
		/**
		 * Unbinds all event handlers for the UI control elements
		 *
		 * @memberOf scats.Renderer
		 * @method unbindEventHandlers
		 */
		unbindEventHandlers: function() {
			$('.ui-controls .btn-edit-binning').unbind('click');
			$('.ui-controls .btn-expand-all').unbind('click');
			$('.ui-controls .btn-collapse-all').unbind('click');
			$('.ui-controls .btn-remove-selection').unbind('click');
		},
		/**
		 * Binds click events to the UI control elements
		 *
		 * @memberOf scats.Renderer
		 * @method setupControls
		 */
		setupControls: function() {
			var self = this;

			this.unbindEventHandlers();

			//setup modal window for binning
			$('#binningViewModal').modal({ show: false });

			$('.ui-controls .btn-edit-binning').on("click", function() {
				console.log("Edit Binning clicked");
				self.binningView.render();
				$('#binningViewModal').modal('show');
			});

			//setup expand-all button
			$('.ui-controls .btn-expand-all').on("click", function() {
				d3.select('.set-group').selectAll('.y-label-group').each(function(d, i) {
					if (!d3.select(this).classed("expanded")) {
						self.expandRow.call(this, d, i, self);
					}
				});
			});

			//setup collapse-all button
			$('.ui-controls .btn-collapse-all').on("click", function() {
				d3.select('.set-group').selectAll('.y-label-group').each(function(d, i) {
					if (d3.select(this).classed("expanded")) {
						self.collapseRow.call(this, d, i, self);
					}
				})
			});

			//setup clear selection button
			$('.ui-controls .btn-remove-selection').on("click", function() {
				self.selectedSubset = undefined;
				self.clearSelection();
				self.table.clear();
			});
		},
		/**
		 * Creates the HTML for the legend based on the scales.color object
		 *
		 * @memberOf scats.Renderer
		 * @method setupLegend
		 */
		setupLegend: function() {
			var self = this;

			/*
			console.log("colors.quantiles() ", this.scales.color.quantiles());
			console.log("colors(3) ", this.scales.color(3));
			*/

			//empty container first
			$('#legend').empty();

			d3.select("#legend")
				.append("h5")
				.text("No. of elements:");

			var legend = d3.select("#legend")
				.append("ul")
				.attr("class", "list-inline");

			var keys = legend.selectAll("li.key")
				.data(this.scales.color.range())
				.enter()
				.append("li")
				.attr("class", "key")
				.style("border-top-color", String)
				.style("width", 100/this.settings.colors.length + "%")
				.text(function(d) {
					var r = self.scales.color.invertExtent(d);
					//console.log("r ", r);
					return "≥ " + Math.round(r[0]);
				});

		},
		/**
		 * Renders the visualization data, common place for drawing the canvas and calling the renderSets method
		 *
		 * @memberOf scats.Renderer
		 * @method render
		 */
		render: function() {
			var self = this,
				width = this.settings.canvas.width,
				height = this.settings.canvas.height;

			//empty canvas first and append tooltip container
			$('#canvas')
				.empty()
				.append('<div id="tooltip" class="hidden"></div>');

			this.svg = d3.select('#canvas').append("svg")
				.attr("width", width + self.settings.canvas.margin.left)
				.attr("height", height)
				.style("margin-left", -self.settings.canvas.margin.left + "px")
				.append("g")
				.attr("transform", "translate(" + self.settings.canvas.margin.left + "," + self.settings.canvas.margin.top + ")");

			this.renderSets();

			var no_of_set_groups = Math.ceil(vis.data.fullGrid.length / this.max_sets_per_group),
				canvasHeight = (this.getSetOuterHeight() + this.settings.canvas.margin.top) * no_of_set_groups;

			this.setCanvasHeight(canvasHeight);
		},
		/**
		 * Computes the total outer width of a set rectangle
		 *
		 * @memberOf scats.Renderer
		 * @method getTotalSetWidth
		 * @returns {int} - The total outer width of a set rectangle
		 */
		getTotalSetWidth: function() {
			return this.settings.set.width + 2 * this.settings.set.stroke + this.settings.set.margin.right;
		},
		/**
		 * Computes the inner height of a set rectangle
		 *
		 * @memberOf scats.Renderer
		 * @method getSetInnerHeight
		 * @returns {int} - The inner height of a set rectangle (without the border)
		 */
		getSetInnerHeight: function() {
			return vis.data.bins.k * this.settings.set.height;
		},
		/**
		 * Computes the outer height of a set rectangle
		 *
		 * @memberOf scats.Renderer
		 * @method getSetOuterHeight
		 * @returns {int} - The outer height of a set rectangle (including the border)
		 */
		getSetOuterHeight: function() {
			return this.getSetInnerHeight() + 2 * this.settings.set.stroke;
		},
		/**
		 * Clears the current selection.
		 *
		 * @memberOf scats.Renderer
		 * @method clearSelection
		 */
		clearSelection: function() {
			//remove circle segments
			d3.selectAll('.highlight-segment').remove();

			//remove highlighted class from selected and highlighted subsets
			d3.selectAll('.subset.selected').classed("selected", false);
			d3.selectAll('.subset.highlighted').classed("highlighted", false);

			//remove highlighted class from x-axis labels and degree labels
			d3.selectAll('.x-label.highlighted').classed("highlighted", false);
			d3.selectAll('.degree-label.highlighted').classed("highlighted", false);

			//remove segment-tooltip class from all highlighted subsets
			d3.selectAll('.subset.segment-tooltip').classed("segment-tooltip", false);

			//set opacity to 1 for subsets, aggregates and x-axis labels
			d3.selectAll('.subset').style("opacity", 1);
			d3.selectAll('.aggregate').style("opacity", 1);
			d3.selectAll('.x-label').style("opacity", 1);
		},
		selectAggregate: function(aggregate, rowIndex) {
			console.log("aggregate ", aggregate);

			var labelGroups = d3.selectAll('.y-label-group'),

				bin = this.data_y_axis[rowIndex];

			console.log("labelGroups ", labelGroups);
			var group = labelGroups.filter(function(d, i) { return i == rowIndex; });

			//console.log("group ", group);

			//d3.select(group).click();

			//this.expandRow.call(d3.select(group[0]), bin, rowIndex, this);

		},
		selectSubset: function(subset) {
			console.log("subset ", subset);

			var self = this,
				set_occurrence_map = vis.helpers.getElementsGroupedBySetAndDegree(subset),
				arc = d3.svg.arc(),
				cx = 0,
				cy = 0,
				r = 0,
				segment_percentage = 0,
				set_ids = [];

			console.log("set_occurrence_map ", set_occurrence_map);

			//first unselect all previously highlighted elements
			this.clearSelection();

			//update selection in table
			this.table.update(subset.elements);

			d3.selectAll('.set-group').selectAll('.subset').each(function(d, i) {
				//console.log("d ", d, "i ", i);

				cx = d3.select(this).attr("cx");
				cy = d3.select(this).attr("cy");
				r = d3.select(this).attr("r");

				//mark the clicked element as selected
				if (d.set_name == subset.set_name && d.degree == subset.degree) {
					d3.select(this)
						.classed("selected", true);

					set_ids.push(parseInt(d3.select(this.parentNode).attr("data-set")));
				} else {
					if (typeof set_occurrence_map[d.set_name] !== "undefined" && typeof set_occurrence_map[d.set_name][d.degree] !== "undefined") {
						//console.log("is ok ", this);

						//add additional class for advanced tooltip
						d3.select(this).classed("segment-tooltip", true);

						segment_percentage = vis.helpers.calcSegmentPercentage(subset, d) * 100;

						arc
							.innerRadius(4)
							.outerRadius(6)
							.startAngle(0)
							.endAngle(self.scales.radianToPercent(segment_percentage));

						d3.select(this.parentNode).append("path")
							.attr("d", arc)
							.attr("class", "highlight-segment")
							.attr("transform", "translate(8," + cy + ")");

						set_ids.push(parseInt(d3.select(this.parentNode).attr("data-set")));
					}
				}

			});

			//reduce opacity for not selected subsets and aggregates
			d3.selectAll('.subset:not(.selected)').style("opacity", 0.3);
			d3.selectAll('.aggregate').style("opacity", 0.3);

			this.highlightSetLabels(set_ids);
			this.highlightDegreeLabel(subset.degree);
		},
		/**
		 * Computes the height of the canvas
		 *
		 * @memberOf scats.Renderer
		 * @method getCanvasHeight
		 * @return {int} - The height of the canvas
		 */
		getCanvasHeight: function() {
			return parseInt(d3.select('#canvas svg').attr("height"));
		},
		/**
		 * Sets the height of the canvas
		 *
		 * @memberOf scats.Renderer
		 * @method setCanvasHeight
		 * @param {int} height - The height value to be set.
		 */
		setCanvasHeight: function(height) {
			d3.select('#canvas svg').attr("height", height);
		},
		arrangeLabels: function() {
			var self = this,
				yLabelGroups = d3.selectAll('.y-label-group.expanded');

			d3.selectAll('.degree-label')
				.remove();

			yLabelGroups.each(function(d, i) {
				var lbl = this;
				d3.select(this.parentNode).selectAll('.degree-label' + ' bin-' + (i + 1))
					.data(d3.select(this).data()[0])
					.enter()
					.append("text")
					.attr("class", "degree-label bin-" + (i+1))
					.attr("x", -6)
					.attr("y", function(d, i) {
						return parseInt(d3.transform(d3.select(lbl).attr("transform")).translate[1]) + (i + 1) * self.settings.set.height;
					})
					.attr("dy", ".32em")
					.attr("text-anchor", "end")
					.text(function(d, i) { return d; });

			});
		},
		expandRow: function(d, i, renderer) {
			var degree_count = d.length,
				label_yPos = d3.transform(d3.select(this).attr("transform")).translate[1],
				binIndex = i,
				additional_height = renderer.settings.set.height * degree_count;

			//console.log("additional_height ", additional_height);

			//clear selection first otherwise selection gets messed up during row expanding
			renderer.clearSelection();

			d3.selectAll('.set-background')
				.attr("height", function(d, i) {
					return parseInt(d3.select(this).attr("height")) + additional_height;
				});

			d3.selectAll('.set-group')
				.attr("transform", function(d, i) {
					var prev = d3.transform(d3.select(this).attr("transform")).translate[1];

					if (i > 0) {
						return "translate(0," + (prev + i * additional_height) + ")";
					} else {
						return "translate(0," + prev + ")";
					}
				});

			var yLabelGroups = d3.selectAll('.y-label-group')
				.attr("transform", function(d, i) {
					var prev = d3.transform(d3.select(this).attr("transform")).translate[1];

					if (prev > label_yPos) {
						return "translate(0," + (prev + additional_height) + ")";
					} else {
						return "translate(0," + prev + ")";
					}
				})
				.attr("class", function(d, i) {
					//sets the expanded resp. collapsed class for the given bin in all set groups
					if (Math.abs(binIndex - i - vis.data.bins.k) % vis.data.bins.k == 0) {
						return "y-label-group expanded";
					} else {
						return d3.select(this).attr("class");
					}
				});

			renderer.arrangeLabels();

			var aggregates = d3.selectAll('.aggregate')
				.attr("cy", function(d, i) {
					if (parseInt(d3.select(this).attr("cy")) > label_yPos) {
						return parseInt(d3.select(this).attr("cy")) + additional_height;
					} else {
						return parseInt(d3.select(this).attr("cy"));
					}
				})
				.attr("class", function(d, i) {
					if (parseInt(d3.select(this).attr("data-bin")) == binIndex && d.count > 0) {
						var isExpanded = d3.select(this).classed("expanded");
						if (!isExpanded) {
							d3.select(this).classed("expanded", true);
						}
					}
					return d3.select(this).attr("class");
				});

			renderer.appendSubsets();

			//update canvas height
			renderer.setCanvasHeight(renderer.getCanvasHeight() + renderer.no_set_groups * additional_height);

			//re-add selection if one exists
			if (renderer.selectedSubset) {
				renderer.selectSubset(renderer.selectedSubset);
			}
		},
		appendSubsets: function() {
			var self = this;

			d3.selectAll('.subset')
				.remove();

			d3.selectAll('.aggregate.expanded').each(function(d, i) {

				var subset_y_pos = parseInt(d3.select(this).attr("cy")),
					subset_x_pos = parseInt(d3.select(this).attr("cx")),
					bin_entries = d3.select(this).data()[0].subsets;

				//console.log("this ", this);
				//console.log("bin_entries ", bin_entries);

				d3.select(this.parentNode).selectAll('.subset.level-' + i)
					.data(bin_entries)
					.enter()
					.append("circle")
					.attr("class", "subset level-" + i)
					.attr("cx", subset_x_pos)
					.attr("cy", function(d, i) { return subset_y_pos + (i + 1) * self.settings.set.height; })
					.attr("r", function(d) { return d.count > 0 ? self.settings.subset.r * 0.75 : 0; }) //set radius to 0 for subsets with 0 elements
					.attr("display", function(d) { return d.count > 0 ? null : "none"; }) //don't show subsets with 0 elements
					//.attr("fill", function(d) { return d.count > 0 ? self.settings.colors[Math.ceil(self.scales.color(d.count))] : "#FFFFFF"; });
					.attr("fill", function(d) { return d.count > 0 ? self.scales.color(d.count) : "#FFFFFF"; });
			});

			//handler for appended subsets
			d3.selectAll('.subset')
				.on("mouseover", function(d, i) {
					//console.log("d ", d);
					var that = this;

					//delay mouseover event for 500ms
					delay = setTimeout(function() {
						var xPos = parseFloat($(that).offset().left) - (self.tooltip.getWidth()/2 + self.getTotalSetWidth()/2 - self.settings.subset.r/2),
							yPos = parseFloat($(that).offset().top) + 3 * self.settings.subset.r;

						//tooltip showing text and selection
						if (d3.select(that).classed("segment-tooltip")) {
							var segment_percentage = vis.helpers.calcSegmentPercentage(self.selectedSubset, d) * 100;

							self.tooltip.update({
									subset: d,
									segmentPercentage: self.scales.radianToPercent(segment_percentage),
									subsetFill: d3.select(that).attr("fill")
								}, "subset_highlight")
								.show(xPos, yPos);

						//tooltip with text only
						} else {

							self.tooltip.update({
								subset: d
							}, "subset")
							.show(xPos, yPos);
						}

					}, 500);
				})
				.on("mouseout", function(d, i) {
					clearTimeout(delay);
					self.tooltip.hide();
				})
				.on("click", function(subset) {
					self.selectedSubset = subset;
					self.selectSubset(subset);
				});

		},
		collapseRow: function(d, i, renderer) {
			var degree_count = d.length,
				label_yPos = d3.transform(d3.select(this).attr("transform")).translate[1],
				binIndex = i,
				additional_height = renderer.settings.set.height * degree_count;

			//clear selection first otherwise selection gets messed up during row expanding
			renderer.clearSelection();

			d3.selectAll('.set-background')
				.attr("height", function(d, i) {
					return parseInt(d3.select(this).attr("height")) - additional_height;
				});

			d3.selectAll('.set-group')
				.attr("transform", function(d, i) {
					var prev = d3.transform(d3.select(this).attr("transform")).translate[1];

					if (i > 0) {
						return "translate(0," + (prev - i * additional_height) + ")";
					} else {
						return "translate(0," + prev + ")";
					}
				});

			var yLabelGroups = d3.selectAll('.y-label-group')
				.attr("transform", function(d, i) {
					var prev = d3.transform(d3.select(this).attr("transform")).translate[1];

					if (prev > label_yPos) {
						return "translate(0," + (prev - additional_height) + ")";
					} else {
						return "translate(0," + prev + ")";
					}
				})
				.attr("class", function(d, i) {
					if (Math.abs(binIndex - i - vis.data.bins.k) % vis.data.bins.k == 0) {
						return "y-label-group collapsed";
					} else {
						return d3.select(this).attr("class");
					}
				});

			renderer.arrangeLabels();

			d3.selectAll('.aggregate')
				.attr("cy", function(d, i) {
					if (parseInt(d3.select(this).attr("cy")) > label_yPos) {
						return parseInt(d3.select(this).attr("cy")) - additional_height;
					} else {
						return parseInt(d3.select(this).attr("cy"));
					}
				})
				.attr("class", function(d, i) {
					if (parseInt(d3.select(this).attr("data-bin")) == binIndex && d.count > 0) {
						var isExpanded = d3.select(this).classed("expanded");
						if (isExpanded) {
							d3.select(this).classed("expanded", false);
						}
					}
					return d3.select(this).attr("class");
				});

			renderer.appendSubsets();

			renderer.setCanvasHeight(renderer.getCanvasHeight() - additional_height);

			//re-add selection if one exists
			if (renderer.selectedSubset) {
				renderer.selectSubset(renderer.selectedSubset);
			}
		},
		highlightSetLabels: function(set_ids) {
			d3.selectAll('.x-label')
				.attr("class", function(d, i) {
					if ($.inArray(i, set_ids) != -1) {
						d3.select(this).classed("highlighted", true);
					}
					return d3.select(this).attr("class");
				});

			//reduce opacity for remaining labels
			d3.selectAll('.x-label:not(.highlighted)')
				.style("opacity", 0.3);
		},
		highlightDegreeLabel: function(degree) {
			d3.selectAll('.degree-label')
				.attr("class", function(d) {
					if (d == degree) {
						d3.select(this).classed("highlighted", true);
					}
					return d3.select(this).attr("class");
				});
		},
		createYAxisLabelData: function () {
			var result = [];
			for (var i = 0; i < vis.data.bins.k; i++) {
				var arr = [],
					counter = vis.data.bins.ranges[i].start;
				while (counter <= vis.data.bins.ranges[i].end) {
					arr.push(counter+1);
					counter++;
				}
				result.push(arr);
			}

			return result;
		},
		renderSets: function() {

			//TODO: remove --> just added for testing
			//this.max_sets_per_group = 10;

			var self = this,
				transposed = vis.helpers.transpose(this.aggregated_bin_data),
				data_per_setGroup = vis.helpers.chunk(transposed, Math.ceil(this.max_sets_per_group))

			console.log("aggregated_bin_data ", this.aggregated_bin_data);

			console.log("vis.data.bins ", vis.data.bins);

			console.log("aggregated bin data ", this.aggregated_bin_data);

			//set number of set groups
			this.no_set_groups = data_per_setGroup.length;

			console.log("data_per_setGroup ", data_per_setGroup);

			var setGroups = this.svg.selectAll('.set-group')
				.data(data_per_setGroup)
				.enter().append("g")
				.attr("class", "set-group")
				.attr("data-set-group", function(d, i) { return i; })
				.attr("transform", function(d, i) {
					var top_offset = self.settings.canvas.margin.top;
					return "translate(0," + (i * (self.getSetOuterHeight() + top_offset)) + ")";
				});

			setGroups.each(renderSets);
			setGroups.each(renderXaxisLabels);
			setGroups.each(renderYaxisLabels);

			function renderSets(d, i) {
				var sets = d3.select(this).selectAll(".set")
					.data(data_per_setGroup[i])
					.enter().append("g")
					.attr("class", "set")
					.attr("transform", function(d, i) {
						//console.log("d ", d, "i ", i);
						return "translate(" + self.scales.x(i) + ", 0)";
					})
					.attr("data-set", function(d, i) {
						//console.log("d ", d, "i ", i);
						return i + parseInt(d3.select(this.parentNode).attr("data-set-group")) * self.max_sets_per_group;
					});

				sets.each(drawSets);
				sets.each(drawAggregates);
			}

			function drawSets(d, i) {
				d3.select(this)
					.append("rect")
					.attr("class", "set-background")
					.attr("x", 0)
					.attr("width", self.settings.set.width)
					.attr("height", vis.data.bins.k * self.settings.set.height);
			}

			function drawAggregates(aggregate, idx) {
				var delay,
					circle = d3.select(this).selectAll('.aggregate')
					.data(aggregate)
					.enter()
					.append("circle")
					.attr("class", "aggregate")
					.attr("cx", self.settings.set.width/2)
					.attr("cy", function(d, i) { return self.scales.y(i) + self.settings.set.height / 2; })
					.attr("r", function(d) { return d.count > 0 ? self.settings.subset.r : 0; }) //set radius to 0 for aggregates with 0 elements
					.attr("display", function(d) { return d.count > 0 ? null : "none"; }) //don't show aggregates with 0 elements
					.attr("data-bin", function(d, i) { return i; })
					//.style("fill", function(d) { return self.settings.colors[Math.ceil(self.scales.color(d.getTotalElements()))]; })
					.style("fill", function(d) { return self.scales.color(d.count); })
					.on("mouseover", onMouseover)
					.on("mouseout", onMouseout)
					.on("click", selectHandler);

				function onMouseover(d, i) {
					//console.log("d ", d);

					var that = this;

					//delay mouseover event for 500ms
					delay = setTimeout(function() {
						var xPos = parseFloat($(that).offset().left) - (self.tooltip.getWidth()/2 + self.getTotalSetWidth()/2 - self.settings.subset.r/2),
							yPos = parseFloat($(that).offset().top) + 3 * self.settings.subset.r;

						self.tooltip.update({
							aggregate: d
						}, "aggregate")
							.show(xPos, yPos);

					}, 500);
				}

				function onMouseout() {
					clearTimeout(delay);
					self.tooltip.hide();
				}

				function selectHandler(aggregate, rowIndex) {
					console.log("aggregate ", aggregate, "rowIndex ", rowIndex);

					//var elements = subset.getElementNames();

					self.selectAggregate(aggregate, rowIndex);
				}

			}

			function renderXaxisLabels(setGroup, index) {
				//x axis data depends on set group whereas the y labels remain the same for each set group
				var data_x_axis = vis.data.sets.slice(index * self.max_sets_per_group, index * self.max_sets_per_group + self.max_sets_per_group);

				//render labels for x axis
				d3.select(this).selectAll('.x-label')
					.data(data_x_axis)
					.enter().append("text")
					.attr("class", "x-label")
					.attr("transform", function(d, i) {
						return "rotate(-90)";
					})
					.attr("x", 6)
					.attr("y", function(d, i) { return self.scales.x(i) + 7; })
					.attr("dy", ".32em")
					.attr("text-anchor", "start")
					.text(function(d, i) { return d.name; });
			}

			function renderYaxisLabels(setGroup, index) {
				var labelGroups = d3.select(this).selectAll('.y-label-group')
					.data(self.data_y_axis)
					.enter().append("g")
					.attr("class", "y-label-group collapsed")
					.attr("data-set-group", function(d) { return index; })
					.attr("transform", function(d, i) {
						return "translate(0," + (i * self.settings.set.height + self.settings.subset.r + 2) + ")";
					});

				labelGroups.each(function(group, idx) {
					//console.log("group ", group, "idx ", idx);

					//append button background
					d3.select(this).append("rect")
						.attr("class", "btn-background")
						.attr("width", self.settings.labelButton.width)
						.attr("height", self.settings.labelButton.height)
						.attr("x", -(self.settings.labelButton.width + self.settings.labelButton.margin.right))
						.attr("y", -(self.settings.labelButton.width/2))
						.attr("rx", self.settings.labelButton.rx)
						.attr("ry", self.settings.labelButton.ry);

					//append expand icon
					d3.select(this).append("text")
						.attr("class", "icon-expand")
						.attr("x", -(self.settings.labelButton.width + self.settings.labelButton.margin.right - 4))
						.attr("y", 3)
						.html("&#xf067");

					//append collapse icon
					d3.select(this).append("text")
						.attr("class", "icon-collapse")
						.attr("x", -(self.settings.labelButton.width + self.settings.labelButton.margin.right - 4))
						.attr("y", 3)
						.html("&#xf068");

					//append label text
					d3.select(this).append("text")
						.attr("class", "y-label")
						.attr("x", -(self.settings.labelButton.width + self.settings.labelButton.margin.right + self.settings.labelButton.margin.left))
						.attr("y", 0)
						.attr("dy", ".32em")
						.attr("text-anchor", "end")
						.text(function(d, i) { return "[" + group[0] + " - " + group[d.length - 1] + "]" ; });

				});

				//attach click handler
				labelGroups.on("click", function(bin, idx) {
					console.log("bin ", bin, "idx ", idx);

					//expand row
					if (!d3.select(this).classed("expanded")) {
						self.expandRow.call(this, bin, idx, self);
					} else {
						//collapse row
						self.collapseRow.call(this, bin, idx, self);
					}
				});

			}

		}
	};

	vis.Renderer = Renderer;

	return vis;

})(scats || {});