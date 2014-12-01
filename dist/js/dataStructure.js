/**
 * Created by martinwortschack on 16/10/14.
 */

var SetVis = (function(vis) {

    function Element(id, name) {
        this.id = id;
        this.name = name;
        this.sets = [];
        this.degree = -1;
        this.getSets = function () {
            return this.sets.join(",");
        };
    }

    function Set(name) {
        this.name = name;
        this.count = 0;
    }

    function SubSet(set_name, degree) {
        this.set_name = set_name;
        this.degree = degree;
        this.elements = [];
        this.count = 0;
    }

    SubSet.prototype = {
        //returns a map from set name to number of elements, i.e., { Set1: 24, ... }
        getSetOccurrenceMap: function(set_name) {
            var setMap = {};

            var duplicates_eliminated = [];
            for (var i = 0, set_str = "", len = this.elements.length; i < len; i++) {
                set_str = this.elements[i].getSets();
                if ($.inArray(set_str, duplicates_eliminated) == -1) {
                    duplicates_eliminated.push(set_str);
                }
            }
            console.log("duplicates_eliminated ", duplicates_eliminated);

            for (var i = 0, len = this.elements.length; i < len; i++) {
                console.log("split ", this.elements[i].getSets().split(","));

                console.log("this.elements[i] ", this.elements[i]);

                var foundPos = $.inArray(this.elements[i].getSets(), duplicates_eliminated);

                if (foundPos != -1) {

                    duplicates_eliminated[foundPos] = undefined;

                    $(this.elements[i].getSets().split(",")).each(function(k, v) {

                        if (setMap[v] !== undefined) {
                            setMap[v]++;
                        } else {
                            setMap[v] = 1;
                        }
                    });
                }

            }
            return setMap;
        },
        getElementNames: function() {
            /*
             var result = [];
             for (var i = 0, el, len = this.elements.length; i < len; i++) {
             el = this.elements[i];
             if ($.inArray(el.name, result) == -1) {
             result.push(el.name);
             }
             }
             return result;
             */

            return $.unique(this.elements.map(function(e) {
                return e.name;
            }));
        }
    };

    function Selection(set, degree) {
        this.set = (set === undefined) ? "" : set;
        this.degree = (degree === undefined) ? -1 : degree;
        this.elements = [];
        this.toString = function () {
            if (this.degree <= 0) { return this.set; }
            if (this.set === "") { return "degree-" + this.degree; }
            return this.set + "[" + this.degree + "]";
        };

    }

    function Table(initializer) {
        this.$container = $(initializer.container);
        this.tableClass = initializer.tableClass || "";
        this.colNames = ["Name", "Degree", "Sets"];
        this.elements = initializer.elements || [];
        this.init();
    }

    Table.prototype = {
        init: function() {
            $table = $('<table>')
                .addClass(this.tableClass)
                .append('<thead>')
                .append('<tbody>');

            this.$container.html($table);
            this.appendTableHead();
            this.update(this.elements);
        },
        appendTableHead: function() {
            var $thead = this.$container.find('thead'),
                content = "<tr>";
            for (var i = 0, len = this.colNames.length; i < len; i++) {
                content += "<th>" + this.colNames[i] + "</th>";
            }
            content += "</tr>"
            $thead.append(content);
        },
        update: function(elements) {
            this.elements = elements;

            var arr = [];
            for (var i = 0, len = this.elements.length; i < len; i++) {
                arr.push("<tr>");
                arr.push("<td>" + this.elements[i].name + "</td>");
                arr.push("<td>" + this.elements[i].degree + "</td>");
                arr.push("<td>" + this.elements[i].sets.join(", ") + "</td>");
                arr.push("</tr>");
            }

            this.$container.find('tbody')
                .empty()
                .html(arr.join(""));
        }
    };

    return $.extend(vis, {
        Element: Element,
        Set: Set,
        SubSet: SubSet,
        Selection: Selection,
        Table: Table
    });

})(SetVis || vis);