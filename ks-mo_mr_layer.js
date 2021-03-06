// ==UserScript==
// @name            KS/MO WME MapRaid Regions
// @author          HBiede
// @namespace       hbiede.com
// @description     Creates polygons for Regions in the KS/MO map raid
// @include         /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor.*$/
// @version         2019.07.23.001
// @grant           none
// @copyright       2019 HBiede, based on work by 2017 Glodenox, based on work by 2015 rickzabel, based on work by 2014 davielde
// ==/UserScript==

// overhauled for KS/MO MapRaid by HBiede

// Grep replacements to find-and-replace convert WKT to JSON areas:
// ".+\(" -> "" (empty string)
// "\(" -> "{lon: '"
// "\)\)" -> "'}" (“0\)\)” for 3D generated WKTs)
// "([0-9])\s([0-9])" -> "\1', lat: '\2"
// "," -> "'}, {lon: '" (“[[:space::]]0,” for 3D generated WKTs)

// To Change for New Raids:
const mapRaidName            = "KS/MO MapRaid";
const mapraidId              = "mapraidKSMO";
const overlayColorFill       = 0.2; // Set to a number between 0 and 1 to adjust the opacity of the color fill for the overlay
const defaultZoomLevel       = 1; // Default zoom level for when a new region is selected from the dropdown. Set to -1 to leave the zoom level unchanged
const polygonStrokeWidth     = 5; // Set the width of the line used to delimit one region from another
const overlayFillOnByDefault = false;


setTimeout(initMapRaidOverlay, 1000);
var mapLayer;


function convertPoints(list) {
    return list.map(function(point) {
        return new OL.Geometry.Point(point.lon, point.lat).transform(new OL.Projection("EPSG:4326"), W.map.getProjectionObject());
    });
}

function addRaidPolygon(raidLayer, dataList) {
    var style = {
        strokeColor: dataList.color,
        strokeOpacity: 0.8,
        strokeWidth: 5,
        fillColor: dataList.color,
        fillOpacity: (localStorage.MapRaidKSMOFill == "true" ? overlayColorFill : 0),
        label: name,
    };

    var polygon = new OL.Geometry.Polygon(new OL.Geometry.LinearRing(convertPoints(dataList.points)));
    var vector = new OL.Feature.Vector(polygon, { name: dataList.name, fullName: dataList.fullName, zoom: (dataList.zoom ? dataList.zoom : defaultZoomLevel), centerPoint: (dataList.centerPoint ? new OL.Geometry.Point(dataList.centerPoint.lon, dataList.centerPoint.lat).transform(new OL.Projection("EPSG:4326"), W.map.getProjectionObject()) : polygon.getCentroid()) }, style);
    raidLayer.addFeatures([ vector ]);
}

function createLayerToggler(parentGroup, checked, checked2, name, toggleCallback, toggleCallback2) {
    var normalizedName = name.toLowerCase().replace(/\s/g, '');
    var group = document.createElement('li');
    var groupToggler = document.createElement('div');
    groupToggler.className = 'controls-container toggler';

    // Main selector
    var groupSwitch = document.createElement('input');
    groupSwitch.id = 'layer-switcher-group_' + normalizedName;
    groupSwitch.className = 'layer-switcher-group_' + normalizedName + '_toggle';
    groupSwitch.type = 'checkbox';
    groupSwitch.checked = checked;
    groupSwitch.addEventListener('click', function() { toggleCallback(groupSwitch.checked); });
    groupToggler.appendChild(groupSwitch);
    var groupLabel = document.createElement('label');
    groupLabel.htmlFor = groupSwitch.id;
    groupLabel.style.display = 'block';
    var groupLabelText = document.createElement('div');
    groupLabelText.className = 'label-text';
    groupLabelText.style.textOverflow = 'ellipsis';
    groupLabelText.style.overflowX = 'hidden';
    groupLabelText.appendChild(document.createTextNode(name));
    groupLabel.appendChild(groupLabelText);
    groupToggler.appendChild(groupLabel);

    // Overlay fill selector
    var group2Div = document.createElement('div');
    group2Div.className = 'controls-container toggler';
    group2Div.style.paddingLeft = "20px";
    var groupSwitch2 = document.createElement('input');
    groupSwitch2.id = 'layer-switcher-group_' + normalizedName + '_fill';
    groupSwitch2.className = 'layer-switcher-group_' + normalizedName + '_fill_toggle';
    groupSwitch2.type = 'checkbox';
    groupSwitch2.checked = checked2;
    groupSwitch2.disabled = !checked;
    groupSwitch2.addEventListener('click', function() { toggleCallback2(groupSwitch2.checked); });
    group2Div.appendChild(groupSwitch2);
    var groupLabel2 = document.createElement('label');
    groupLabel2.htmlFor = groupSwitch2.id;
    groupLabel2.style.display = 'block';
    var groupLabelText2 = document.createElement('div');
    groupLabelText2.className = 'label-text';
    groupLabelText2.style.textOverflow = 'ellipsis';
    groupLabelText2.style.overflowX = 'hidden';
    groupLabelText2.appendChild(document.createTextNode("Fill area"));
    groupLabel2.appendChild(groupLabelText2);
    group2Div.appendChild(groupLabel2);
    groupToggler.appendChild(group2Div);

    group.appendChild(groupToggler);
    if (parentGroup !== null) {
        parentGroup.querySelector('input.toggle').addEventListener('click', function(e) {
            groupSwitch.disabled = !e.target.checked;
            if (toggleCallback) {
                toggleCallback(groupSwitch.checked && e.target.checked);
            }
        });
        parentGroup.querySelector('input.toggle').addEventListener('click', function(e) {
            groupSwitch2.disabled = !e.target.checked;
            if (toggleCallback2) {
                toggleCallback2(groupSwitch2.checked && e.target.checked);
            }
        });
        parentGroup.querySelector('ul.children').appendChild(group);
    } else {
        group.className = 'group';
        groupToggler.classList.add('main');
        var groupChildren = document.createElement('ul');
        groupChildren.className = 'children';
        group.appendChild(groupChildren);
        document.querySelector('.list-unstyled.togglers').appendChild(group);
    }
}

function displayCurrentRaidLocation() {
    var raidMapCenter = W.map.getCenter();
	var raidCenterPoint = new OL.Geometry.Point(raidMapCenter.lon, raidMapCenter.lat);
	var locationDiv = document.querySelector('#topbar-container > div > div > div.location-info-region > div');
	var mapRaidDiv = locationDiv.querySelector('strong');
	if (mapRaidDiv === null) {
		mapRaidDiv = document.createElement('strong');
		mapRaidDiv.setAttribute("id", mapraidId + "LocationDisplay");
		mapRaidDiv.style.marginLeft = '5px';
		locationDiv.appendChild(mapRaidDiv);
	}
    if (localStorage.MapRaidKSMOVisible == "true") {
		var i;
		for (i = 0; i < mapLayer.features.length; i++) {
			if (mapLayer.features[i].geometry.components[0].containsPoint(raidCenterPoint)) {
				mapRaidDiv.textContent = '[' + mapRaidName + ' Region: ' + mapLayer.features[i].attributes.fullName + ']';
				mapRaidDiv.style.color = (mapLayer.features[i].style.fillColor && localStorage.MapRaidKSMOFill == "true" ? mapLayer.features[i].style.fillColor : "#FFF"); // color the top bar text with the region color if area fill is enabled
				return;
			}
		}
    }
    mapRaidDiv.textContent = '';
}

function initMapRaidOverlay() {
    if (typeof W === 'undefined' || typeof W.map === 'undefined' || typeof W.loginManager === 'undefined' || !document.querySelector('#topbar-container > div > div > div.location-info-region > div') || !document.getElementById('layer-switcher-group_display')) {
        setTimeout(initMapRaidOverlay, 800);
        return;
    }
    if (!W.loginManager.user) {
        // init on login for non-logged in users
        W.loginManager.events.register("login", null, initMapRaidOverlay);
        W.loginManager.events.register("loginStatus", null, initMapRaidOverlay);
        if (!W.loginManager.user) {
            return;
        }
    }

    // establish stored variables to track checked status of the display toggle switches
    if (localStorage.MapRaidKSMOVisible === undefined) {
        localStorage.MapRaidKSMOVisible = true;
    }
    if (localStorage.MapRaidKSMOFill === undefined) {
        localStorage.MapRaidKSMOFill = overlayFillOnByDefault;
    }

    mapLayer = new OL.Layer.Vector(mapRaidName + " Regions", {
        uniqueName: mapraidId
    });

    //replace groupPoints with custom coordinates, add or remove groups as needed (centerPoint and zoom can be set to choose where the dropdown moves the map to, else will be set to the centroid of the polygon and defaultZoomLevel respectively)
    let groupsData  =   [{
                            name: "Group 1",
                            fullName: "Group 1 - Northwest Kansas",
                            color: "#F4B400",
                            points: [{lon: '-96.35378', lat: '38.521657'}, {lon: '-96.357277', lat: '38.17266'}, {lon: '-96.358099', lat: '38.085817'}, {lon: '-96.522782', lat: '38.08637'}, {lon: '-96.840772', lat: '38.085622'}, {lon: '-97.152913', lat: '38.087704'}, {lon: '-97.153093', lat: '38.174634'}, {lon: '-97.37175', lat: '38.173673'}, {lon: '-97.701841', lat: '38.173814'}, {lon: '-97.922136', lat: '38.173713'}, {lon: '-97.924269', lat: '38.522755'}, {lon: '-98.480377', lat: '38.521841'}, {lon: '-98.479913', lat: '38.681528'}, {lon: '-98.486108', lat: '38.696878'}, {lon: '-99.032971', lat: '38.696759'}, {lon: '-99.042626', lat: '38.696807'}, {lon: '-99.585087', lat: '38.696537'}, {lon: '-99.598323', lat: '38.696514'}, {lon: '-100.153823', lat: '38.697341'}, {lon: '-100.2472', lat: '38.698165'}, {lon: '-100.688006', lat: '38.700021'}, {lon: '-100.818698', lat: '38.699861'}, {lon: '-101.128379', lat: '38.700603'}, {lon: '-101.484383', lat: '38.700166'}, {lon: '-101.567094', lat: '38.699669'}, {lon: '-102.045712903087', lat: '38.6975657700785'}, {lon: '-102.046571', lat: '39.047038'}, {lon: '-102.047200721701', lat: '39.1331467095112'}, {lon: '-102.04896', lat: '39.373712'}, {lon: '-102.049961857828', lat: '39.5681789806731'}, {lon: '-102.049992135644', lat: '39.574056097421'}, {lon: '-102.051254', lat: '39.818992'}, {lon: '-102.051744', lat: '40.003078'}, {lon: '-101.832161', lat: '40.002933'}, {lon: '-101.542273', lat: '40.002609'}, {lon: '-101.411028987802', lat: '40.0025825695676'}, {lon: '-101.325514027519', lat: '40.0025653482305'}, {lon: '-101.293991', lat: '40.002559'}, {lon: '-101.060317', lat: '40.002307'}, {lon: '-100.75883', lat: '40.002302'}, {lon: '-100.738824713191', lat: '40.0022629565677'}, {lon: '-100.477018', lat: '40.001752'}, {lon: '-100.193599056836', lat: '40.0015730057199'}, {lon: '-100.19359', lat: '40.001573'}, {lon: '-100.177797545879', lat: '40.0015658138516'}, {lon: '-99.813401', lat: '40.0014'}, {lon: '-99.6282538492245', lat: '40.0017719472684'}, {lon: '-99.6253267263996', lat: '40.001777827647'}, {lon: '-99.501792', lat: '40.002026'}, {lon: '-99.1791331508611', lat: '40.0021089526949'}, {lon: '-99.085597', lat: '40.002133'}, {lon: '-99.0670183498981', lat: '40.0021435130522'}, {lon: '-98.726372963939', lat: '40.0023362731669'}, {lon: '-98.613755', lat: '40.0024'}, {lon: '-98.5044549836368', lat: '40.002379876736'}, {lon: '-98.2740170597529', lat: '40.0023374507299'}, {lon: '-98.076034', lat: '40.002301'}, {lon: '-97.9318249263172', lat: '40.0022363450196'}, {lon: '-97.8215008122752', lat: '40.0021868820889'}, {lon: '-97.777155', lat: '40.002167'}, {lon: '-97.415833', lat: '40.002001'}, {lon: '-97.369199035315', lat: '40.0019393057605'}, {lon: '-97.009165', lat: '40.001463'}, {lon: '-96.9164070054658', lat: '40.0014540910439'}, {lon: '-96.873812', lat: '40.00145'}, {lon: '-96.805768', lat: '40.0013684550954'}, {lon: '-96.806201', lat: '39.827538'}, {lon: '-96.806544', lat: '39.566423'}, {lon: '-96.958719', lat: '39.566401'}, {lon: '-96.961693', lat: '39.220076'}, {lon: '-96.849879', lat: '39.219012'}, {lon: '-96.851409', lat: '39.088176'}, {lon: '-96.501166', lat: '39.043666'}, {lon: '-96.501556', lat: '38.869704'}, {lon: '-96.501397', lat: '38.826188'}, {lon: '-96.390398', lat: '38.825858'}, {lon: '-96.389749', lat: '38.738984'}, {lon: '-96.352613', lat: '38.739021'}, {lon: '-96.35378', lat: '38.521657'}]
                        },
                        {
                            name: "Group 2",
                            fullName: "Group 2 - Southwest Kansas",
                            color: "#EE9C96",
                            points: [{lon: '-97.807823', lat: '37.733855'}, {lon: '-97.8076', lat: '37.474184'}, {lon: '-97.807057', lat: '37.386293'}, {lon: '-97.804337', lat: '37.366069'}, {lon: '-97.8023129703503', lat: '36.998698609394'}, {lon: '-98.045342', lat: '36.998327'}, {lon: '-98.1119851837458', lat: '36.9982479946353'}, {lon: '-98.3471487797447', lat: '36.9979692086496'}, {lon: '-98.354073', lat: '36.997961'}, {lon: '-98.5446619733489', lat: '36.9985242404006'}, {lon: '-98.791936', lat: '36.999255'}, {lon: '-99.0003010538842', lat: '36.9993580981444'}, {lon: '-99.129449', lat: '36.999422'}, {lon: '-99.407015', lat: '36.999579'}, {lon: '-99.4562024346753', lat: '36.9997002794079'}, {lon: '-99.5411149123609', lat: '36.9999096445655'}, {lon: '-99.657658', lat: '37.000197'}, {lon: '-99.995201', lat: '37.001631'}, {lon: '-100.002571514322', lat: '37.001619153912'}, {lon: '-100.089481743903', lat: '37.0014794694635'}, {lon: '-100.552683', lat: '37.000735'}, {lon: '-100.633324986158', lat: '37.0001736090529'}, {lon: '-100.855634', lat: '36.998626'}, {lon: '-100.945466793078', lat: '36.9982468287288'}, {lon: '-101.06645021566', lat: '36.9977361751404'}, {lon: '-101.211486', lat: '36.997124'}, {lon: '-101.485326', lat: '36.995611'}, {lon: '-101.555258848691', lat: '36.9952909392776'}, {lon: '-101.90244', lat: '36.993702'}, {lon: '-102.028204191045', lat: '36.9931451471083'}, {lon: '-102.04224', lat: '36.993083'}, {lon: '-102.04192', lat: '37.035083'}, {lon: '-102.041983', lat: '37.106551'}, {lon: '-102.041963', lat: '37.258164'}, {lon: '-102.041938522874', lat: '37.3891900553938'}, {lon: '-102.041890869665', lat: '37.6442776852918'}, {lon: '-102.041876', lat: '37.723875'}, {lon: '-102.041965658628', lat: '37.7385405736382'}, {lon: '-102.044255', lat: '38.113011'}, {lon: '-102.044634270291', lat: '38.2624115677495'}, {lon: '-102.044650359147', lat: '38.2687492225031'}, {lon: '-102.044944', lat: '38.384419'}, {lon: '-102.04551057457', lat: '38.6151645901775'}, {lon: '-102.045712903087', lat: '38.6975657700785'}, {lon: '-101.567094', lat: '38.699669'}, {lon: '-101.484383', lat: '38.700166'}, {lon: '-101.128379', lat: '38.700603'}, {lon: '-100.818698', lat: '38.699861'}, {lon: '-100.688006', lat: '38.700021'}, {lon: '-100.2472', lat: '38.698165'}, {lon: '-100.153823', lat: '38.697341'}, {lon: '-99.598323', lat: '38.696514'}, {lon: '-99.585087', lat: '38.696537'}, {lon: '-99.042626', lat: '38.696807'}, {lon: '-99.032971', lat: '38.696759'}, {lon: '-98.486108', lat: '38.696878'}, {lon: '-98.479913', lat: '38.681528'}, {lon: '-98.480377', lat: '38.521841'}, {lon: '-97.924269', lat: '38.522755'}, {lon: '-97.922136', lat: '38.173713'}, {lon: '-97.701841', lat: '38.173814'}, {lon: '-97.701969', lat: '37.911325'}, {lon: '-97.698692', lat: '37.735056'}, {lon: '-97.807823', lat: '37.733855'}]
                        },
                        {
                            name: "Group 3",
                            fullName: "Group 3 - Kansas East",
                            color: "#A61B4A",
                            points: [{lon: '-95.9642712321022', lat: '36.9992231442824'}, {lon: '-96.0008102061996', lat: '36.9992010529279'}, {lon: '-96.217571', lat: '36.99907'}, {lon: '-96.500288', lat: '36.998643'}, {lon: '-96.5255820442829', lat: '36.9986779687248'}, {lon: '-96.524873', lat: '37.30273'}, {lon: '-96.52569', lat: '37.476405'}, {lon: '-96.5253', lat: '37.607015'}, {lon: '-96.522782', lat: '38.08637'}, {lon: '-96.358099', lat: '38.085817'}, {lon: '-96.357277', lat: '38.17266'}, {lon: '-96.35378', lat: '38.521657'}, {lon: '-96.352613', lat: '38.739021'}, {lon: '-96.389749', lat: '38.738984'}, {lon: '-96.390398', lat: '38.825858'}, {lon: '-96.501397', lat: '38.826188'}, {lon: '-96.501556', lat: '38.869704'}, {lon: '-96.501166', lat: '39.043666'}, {lon: '-96.851409', lat: '39.088176'}, {lon: '-96.849879', lat: '39.219012'}, {lon: '-96.961693', lat: '39.220076'}, {lon: '-96.958719', lat: '39.566401'}, {lon: '-96.806544', lat: '39.566423'}, {lon: '-96.806201', lat: '39.827538'}, {lon: '-96.805768', lat: '40.0013684550954'}, {lon: '-96.469945', lat: '40.000966'}, {lon: '-96.4637120767748', lat: '40.0009585725545'}, {lon: '-96.2392078784111', lat: '40.0006910427544'}, {lon: '-96.239172', lat: '40.000691'}, {lon: '-96.154365', lat: '40.000495'}, {lon: '-96.02409', lat: '40.000719'}, {lon: '-96.0106788179345', lat: '40.000704665772'}, {lon: '-95.7881109948917', lat: '40.0004667793653'}, {lon: '-95.784575', lat: '40.000463'}, {lon: '-95.3398959708503', lat: '40.0000288571054'}, {lon: '-95.30829', lat: '39.999998'}, {lon: '-95.231114', lat: '39.943784'}, {lon: '-95.142445', lat: '39.89542'}, {lon: '-95.081534', lat: '39.861718'}, {lon: '-95.018743', lat: '39.897372'}, {lon: '-94.9933742397144', lat: '39.8985652599923'}, {lon: '-94.95154', lat: '39.900533'}, {lon: '-94.928466', lat: '39.876344'}, {lon: '-94.878677', lat: '39.826522'}, {lon: '-94.8778175298512', lat: '39.8204147760355'}, {lon: '-94.871144', lat: '39.772994'}, {lon: '-94.860371', lat: '39.74953'}, {lon: '-94.899316', lat: '39.724042'}, {lon: '-94.971078', lat: '39.723146'}, {lon: '-94.971317', lat: '39.68641'}, {lon: '-95.037464', lat: '39.652905'}, {lon: '-95.0440507525704', lat: '39.6136682968209'}, {lon: '-95.047165', lat: '39.595117'}, {lon: '-95.076688', lat: '39.576764'}, {lon: '-95.113557', lat: '39.553941'}, {lon: '-95.091419402824', lat: '39.53325788521'}, {lon: '-95.049845', lat: '39.494415'}, {lon: '-94.982144', lat: '39.440552'}, {lon: '-94.9657474186335', lat: '39.4216817446564'}, {lon: '-94.946662', lat: '39.399717'}, {lon: '-94.888972', lat: '39.392432'}, {lon: '-94.908065', lat: '39.323663'}, {lon: '-94.857072', lat: '39.273825'}, {lon: '-94.825663', lat: '39.241729'}, {lon: '-94.799663', lat: '39.206018'}, {lon: '-94.7919946737433', lat: '39.2012602502402'}, {lon: '-94.900191', lat: '39.202911'}, {lon: '-94.908765', lat: '38.991401'}, {lon: '-94.923349', lat: '39.002633'}, {lon: '-95.056258', lat: '38.98212'}, {lon: '-95.056412', lat: '38.738587'}, {lon: '-94.908606', lat: '38.738281'}, {lon: '-94.6094896723458', lat: '38.7381017094732'}, {lon: '-94.6119580183223', lat: '38.5476344342717'}, {lon: '-94.6128655959221', lat: '38.4776021802351'}, {lon: '-94.612866', lat: '38.477571'}, {lon: '-94.6127726289929', lat: '38.3887184827318'}, {lon: '-94.612614', lat: '38.237766'}, {lon: '-94.6139299610557', lat: '38.0600529598965'}, {lon: '-94.6141002487054', lat: '38.0370565833813'}, {lon: '-94.614465', lat: '37.987799'}, {lon: '-94.617885', lat: '37.682214'}, {lon: '-94.6178724508981', lat: '37.6731107003321'}, {lon: '-94.6178455243542', lat: '37.6535777966344'}, {lon: '-94.617511', lat: '37.410909'}, {lon: '-94.6176676047008', lat: '37.3641703270387'}, {lon: '-94.6177538916066', lat: '37.338418'}, {lon: '-94.618351', lat: '37.160211'}, {lon: '-94.618102891103', lat: '37.0567963908729'}, {lon: '-94.617964', lat: '36.998905'}, {lon: '-94.71277', lat: '36.998794'}, {lon: '-94.995293', lat: '36.999529'}, {lon: '-95.0076200044721', lat: '36.9995225591258'}, {lon: '-95.0735039666303', lat: '36.9994881346791'}, {lon: '-95.322565', lat: '36.999358'}, {lon: '-95.4076200058771', lat: '36.9993417366391'}, {lon: '-95.5224145523987', lat: '36.9993197867829'}, {lon: '-95.573598', lat: '36.99931'}, {lon: '-95.7867618707782', lat: '36.999270917592'}, {lon: '-95.928122', lat: '36.999245'}, {lon: '-95.9642712321022', lat: '36.9992231442824'}]
                        },
                        {
                            name: "Group 4",
                            fullName: "Group 4 - Wichita Metro",
                            color: "#F4EB37",
                            centerPoint: {lon: "-97.32472", lat: "37.69305"},
                            zoom: 4,
                            points: [{lon: '-96.52569', lat: '37.476405'}, {lon: '-96.524873', lat: '37.30273'}, {lon: '-96.5255820442829', lat: '36.9986779687248'}, {lon: '-96.749838', lat: '36.998988'}, {lon: '-97.100652', lat: '36.998998'}, {lon: '-97.1477209669227', lat: '36.9989723356215'}, {lon: '-97.384925', lat: '36.998843'}, {lon: '-97.4623460298641', lat: '36.9988242387969'}, {lon: '-97.768704', lat: '36.99875'}, {lon: '-97.8023129703503', lat: '36.998698609394'}, {lon: '-97.804337', lat: '37.366069'}, {lon: '-97.807057', lat: '37.386293'}, {lon: '-97.8076', lat: '37.474184'}, {lon: '-97.807823', lat: '37.733855'}, {lon: '-97.698692', lat: '37.735056'}, {lon: '-97.701969', lat: '37.911325'}, {lon: '-97.701841', lat: '38.173814'}, {lon: '-97.37175', lat: '38.173673'}, {lon: '-97.153093', lat: '38.174634'}, {lon: '-97.152913', lat: '38.087704'}, {lon: '-96.840772', lat: '38.085622'}, {lon: '-96.522782', lat: '38.08637'}, {lon: '-96.5253', lat: '37.607015'}, {lon: '-96.52569', lat: '37.476405'}]
                        },
                        {
                            name: "Group 5",
                            fullName: "Group 5 - Northwest Missouri",
                            color: "#7CCFA9",
                            centerPoint: {lon: "-93.96124", lat: "39.91229"},
                            points: [{lon: '-94.2322407102083', lat: '40.5720146121266'}, {lon: '-94.091085', lat: '40.572897'}, {lon: '-94.015492', lat: '40.5740737070096'}, {lon: '-93.84093', lat: '40.576791'}, {lon: '-93.7743442040303', lat: '40.5775304533911'}, {lon: '-93.597352', lat: '40.579496'}, {lon: '-93.5568966742717', lat: '40.5796594850605'}, {lon: '-93.3743862587638', lat: '40.5803970326092'}, {lon: '-93.345442', lat: '40.580514'}, {lon: '-93.135802', lat: '40.582854'}, {lon: '-93.0972912037498', lat: '40.5838234773251'}, {lon: '-92.941595', lat: '40.587743'}, {lon: '-92.714597263045', lat: '40.5895828338363'}, {lon: '-92.683162', lat: '40.560663'}, {lon: '-92.70932', lat: '40.445893'}, {lon: '-92.684167', lat: '40.343466'}, {lon: '-92.855629', lat: '40.342736'}, {lon: '-92.856191', lat: '40.037253'}, {lon: '-92.847477', lat: '40.037301'}, {lon: '-92.85792', lat: '39.699985'}, {lon: '-92.689331', lat: '39.698094'}, {lon: '-92.692149', lat: '39.610265'}, {lon: '-92.697228', lat: '39.597699'}, {lon: '-92.707367', lat: '39.321614'}, {lon: '-92.790369', lat: '39.343586'}, {lon: '-92.849224', lat: '39.226218'}, {lon: '-92.911669', lat: '39.223946'}, {lon: '-92.959801', lat: '39.312526'}, {lon: '-93.072915', lat: '39.33552'}, {lon: '-93.104485', lat: '39.383656'}, {lon: '-93.200708', lat: '39.401787'}, {lon: '-93.230079', lat: '39.327877'}, {lon: '-93.332252', lat: '39.309606'}, {lon: '-93.333337', lat: '39.250012'}, {lon: '-93.399133', lat: '39.226437'}, {lon: '-93.477233', lat: '39.292796'}, {lon: '-93.49196', lat: '39.223461'}, {lon: '-93.650526', lat: '39.248214'}, {lon: '-93.758463', lat: '39.207021'}, {lon: '-93.759183', lat: '39.524558'}, {lon: '-94.208423', lat: '39.5272'}, {lon: '-94.210642', lat: '39.454682'}, {lon: '-94.600819', lat: '39.456155'}, {lon: '-94.601246', lat: '39.530372'}, {lon: '-94.627599', lat: '39.531993'}, {lon: '-95.091419402824', lat: '39.53325788521'}, {lon: '-95.113557', lat: '39.553941'}, {lon: '-95.076688', lat: '39.576764'}, {lon: '-95.047165', lat: '39.595117'}, {lon: '-95.0440507525704', lat: '39.6136682968209'}, {lon: '-95.037464', lat: '39.652905'}, {lon: '-94.971317', lat: '39.68641'}, {lon: '-94.971078', lat: '39.723146'}, {lon: '-94.899316', lat: '39.724042'}, {lon: '-94.860371', lat: '39.74953'}, {lon: '-94.871144', lat: '39.772994'}, {lon: '-94.8778175298512', lat: '39.8204147760355'}, {lon: '-94.878677', lat: '39.826522'}, {lon: '-94.928466', lat: '39.876344'}, {lon: '-94.95154', lat: '39.900533'}, {lon: '-94.9933742397144', lat: '39.8985652599923'}, {lon: '-95.018743', lat: '39.897372'}, {lon: '-95.081534', lat: '39.861718'}, {lon: '-95.142445', lat: '39.89542'}, {lon: '-95.231114', lat: '39.943784'}, {lon: '-95.30829', lat: '39.999998'}, {lon: '-95.348777', lat: '40.029297'}, {lon: '-95.382957', lat: '40.027112'}, {lon: '-95.414734', lat: '40.06982'}, {lon: '-95.394216', lat: '40.108263'}, {lon: '-95.432165', lat: '40.141025'}, {lon: '-95.48102', lat: '40.188524'}, {lon: '-95.472548', lat: '40.236078'}, {lon: '-95.54716', lat: '40.259066'}, {lon: '-95.5478703162703', lat: '40.2627834608198'}, {lon: '-95.5481820011801', lat: '40.2644146728427'}, {lon: '-95.553292', lat: '40.291158'}, {lon: '-95.598657', lat: '40.309809'}, {lon: '-95.653729', lat: '40.322582'}, {lon: '-95.641027', lat: '40.366399'}, {lon: '-95.649418', lat: '40.396149'}, {lon: '-95.684363', lat: '40.463366'}, {lon: '-95.694726', lat: '40.493602'}, {lon: '-95.7122803718011', lat: '40.5237544262074'}, {lon: '-95.714291', lat: '40.527208'}, {lon: '-95.75711', lat: '40.52599'}, {lon: '-95.765645', lat: '40.585208'}, {lon: '-95.533182', lat: '40.582249'}, {lon: '-95.3739250533987', lat: '40.5803323779415'}, {lon: '-95.335588', lat: '40.579871'}, {lon: '-95.2022660008303', lat: '40.578375628996'}, {lon: '-95.068921', lat: '40.57688'}, {lon: '-94.9148978673616', lat: '40.5749211691113'}, {lon: '-94.819978', lat: '40.573714'}, {lon: '-94.6320259176948', lat: '40.5717595874'}, {lon: '-94.533878', lat: '40.570739'}, {lon: '-94.4712077271232', lat: '40.570959458357'}, {lon: '-94.310724', lat: '40.571524'}, {lon: '-94.2322407102083', lat: '40.5720146121266'}]
                        },
                        {
                            name: "Group 6",
                            fullName: "Group 6 - Northeast Missouri",
                            color: "#4186f0",
                            points: [{lon: '-92.855629', lat: '40.342736'}, {lon: '-92.684167', lat: '40.343466'}, {lon: '-92.70932', lat: '40.445893'}, {lon: '-92.683162', lat: '40.560663'}, {lon: '-92.714597263045', lat: '40.5895828338363'}, {lon: '-92.686693', lat: '40.589809'}, {lon: '-92.6379032935995', lat: '40.5909565470979'}, {lon: '-92.453745', lat: '40.595288'}, {lon: '-92.3508041867264', lat: '40.5972572763761'}, {lon: '-92.17978', lat: '40.600529'}, {lon: '-91.9431174596857', lat: '40.606060586354'}, {lon: '-91.939292', lat: '40.60615'}, {lon: '-91.729115', lat: '40.61364'}, {lon: '-91.7166549876819', lat: '40.603740139296'}, {lon: '-91.685381', lat: '40.578892'}, {lon: '-91.670993', lat: '40.550937'}, {lon: '-91.618999', lat: '40.539084'}, {lon: '-91.608347', lat: '40.50004'}, {lon: '-91.563844', lat: '40.460988'}, {lon: '-91.519134', lat: '40.432822'}, {lon: '-91.498093', lat: '40.401926'}, {lon: '-91.419422', lat: '40.378264'}, {lon: '-91.469656', lat: '40.322409'}, {lon: '-91.492891', lat: '40.269923'}, {lon: '-91.4969574903395', lat: '40.2487038763728'}, {lon: '-91.5061679086223', lat: '40.2006435127951'}, {lon: '-91.511956', lat: '40.170441'}, {lon: '-91.497663', lat: '40.078257'}, {lon: '-91.484064', lat: '40.019332'}, {lon: '-91.43709', lat: '39.946417'}, {lon: '-91.4368432685991', lat: '39.9452434636785'}, {lon: '-91.428956', lat: '39.907729'}, {lon: '-91.436051', lat: '39.84551'}, {lon: '-91.397853', lat: '39.821122'}, {lon: '-91.361571', lat: '39.787548'}, {lon: '-91.3646166033233', lat: '39.7587182263223'}, {lon: '-91.367753', lat: '39.729029'}, {lon: '-91.3057603349652', lat: '39.6862154700779'}, {lon: '-91.27614', lat: '39.665759'}, {lon: '-91.1828755008197', lat: '39.5982331157954'}, {lon: '-91.174232', lat: '39.591975'}, {lon: '-91.148275', lat: '39.545798'}, {lon: '-91.100307', lat: '39.538695'}, {lon: '-91.064305', lat: '39.494643'}, {lon: '-91.03827', lat: '39.448436'}, {lon: '-90.937419', lat: '39.400803'}, {lon: '-90.9353499463686', lat: '39.3995195289071'}, {lon: '-90.840106', lat: '39.340438'}, {lon: '-90.72996', lat: '39.255894'}, {lon: '-90.7232836234127', lat: '39.2241029700576'}, {lon: '-90.707902', lat: '39.15086'}, {lon: '-90.681086', lat: '39.10059'}, {lon: '-90.713629', lat: '39.053977'}, {lon: '-90.676397', lat: '38.984096'}, {lon: '-90.6615829068768', lat: '38.9347033077532'}, {lon: '-90.707557', lat: '38.902652'}, {lon: '-90.817827', lat: '38.875966'}, {lon: '-90.958536', lat: '38.870865'}, {lon: '-90.964461', lat: '38.547545'}, {lon: '-91.077324', lat: '38.609343'}, {lon: '-91.226547', lat: '38.621567'}, {lon: '-91.319022', lat: '38.708368'}, {lon: '-91.369192', lat: '38.699324'}, {lon: '-91.418637', lat: '38.709778'}, {lon: '-91.558185', lat: '38.676635'}, {lon: '-91.640372', lat: '38.703792'}, {lon: '-91.647171', lat: '38.703396'}, {lon: '-91.633998', lat: '39.059057'}, {lon: '-92.110387', lat: '39.064204'}, {lon: '-92.104374', lat: '39.239809'}, {lon: '-92.314471', lat: '39.246454'}, {lon: '-92.430229', lat: '39.248795'}, {lon: '-92.707367', lat: '39.321614'}, {lon: '-92.697228', lat: '39.597699'}, {lon: '-92.692149', lat: '39.610265'}, {lon: '-92.689331', lat: '39.698094'}, {lon: '-92.85792', lat: '39.699985'}, {lon: '-92.847477', lat: '40.037301'}, {lon: '-92.856191', lat: '40.037253'}, {lon: '-92.855629', lat: '40.342736'}]
                        },
                        {
                            name: "Group 7",
                            fullName: "Group 7 - KC Metro",
                            color: "#FFDD5E",
                            zoom: 3,
                            centerPoint: {lon: "-94.57468", lat: "39.09549"},
                            points: [{lon: '-95.056258', lat: '38.98212'}, {lon: '-94.923349', lat: '39.002633'}, {lon: '-94.908765', lat: '38.991401'}, {lon: '-94.900191', lat: '39.202911'}, {lon: '-94.7919946737433', lat: '39.2012602502402'}, {lon: '-94.799663', lat: '39.206018'}, {lon: '-94.825663', lat: '39.241729'}, {lon: '-94.857072', lat: '39.273825'}, {lon: '-94.908065', lat: '39.323663'}, {lon: '-94.888972', lat: '39.392432'}, {lon: '-94.946662', lat: '39.399717'}, {lon: '-94.9657474186335', lat: '39.4216817446564'}, {lon: '-94.982144', lat: '39.440552'}, {lon: '-95.049845', lat: '39.494415'}, {lon: '-95.091419402824', lat: '39.53325788521'}, {lon: '-94.627599', lat: '39.531993'}, {lon: '-94.601246', lat: '39.530372'}, {lon: '-94.600819', lat: '39.456155'}, {lon: '-94.210642', lat: '39.454682'}, {lon: '-94.208423', lat: '39.5272'}, {lon: '-93.759183', lat: '39.524558'}, {lon: '-93.758463', lat: '39.207021'}, {lon: '-93.650526', lat: '39.248214'}, {lon: '-93.49196', lat: '39.223461'}, {lon: '-93.477233', lat: '39.292796'}, {lon: '-93.399133', lat: '39.226437'}, {lon: '-93.333337', lat: '39.250012'}, {lon: '-93.332252', lat: '39.309606'}, {lon: '-93.230079', lat: '39.327877'}, {lon: '-93.200708', lat: '39.401787'}, {lon: '-93.104485', lat: '39.383656'}, {lon: '-93.072915', lat: '39.33552'}, {lon: '-92.959801', lat: '39.312526'}, {lon: '-92.911669', lat: '39.223946'}, {lon: '-92.849224', lat: '39.226218'}, {lon: '-92.94385', lat: '39.121738'}, {lon: '-92.934569', lat: '39.064547'}, {lon: '-93.048471', lat: '38.972418'}, {lon: '-93.050453', lat: '38.928244'}, {lon: '-93.059974', lat: '38.693077'}, {lon: '-93.067291', lat: '38.529995'}, {lon: '-93.290454', lat: '38.535388'}, {lon: '-93.291851', lat: '38.506321'}, {lon: '-93.512743', lat: '38.512476'}, {lon: '-93.51103', lat: '38.55621'}, {lon: '-94.064317', lat: '38.56738'}, {lon: '-94.06782', lat: '38.466016'}, {lon: '-94.065713', lat: '38.447087'}, {lon: '-94.212023', lat: '38.446754'}, {lon: '-94.31217', lat: '38.471496'}, {lon: '-94.6128655959221', lat: '38.4776021802351'}, {lon: '-94.6119580183223', lat: '38.5476344342717'}, {lon: '-94.6094896723458', lat: '38.7381017094732'}, {lon: '-94.908606', lat: '38.738281'}, {lon: '-95.056412', lat: '38.738587'}, {lon: '-95.056258', lat: '38.98212'}]
                        },
                        {
                            name: "Group 8",
                            fullName: "Group 8 - Central Missouri",
                            color: "#795046",
                            centerPoint: {lon: "-91.77280", lat: "37.94327"},
                            points: [{lon: '-92.430229', lat: '39.248795'}, {lon: '-92.314471', lat: '39.246454'}, {lon: '-92.104374', lat: '39.239809'}, {lon: '-92.110387', lat: '39.064204'}, {lon: '-91.633998', lat: '39.059057'}, {lon: '-91.647171', lat: '38.703396'}, {lon: '-91.640372', lat: '38.703792'}, {lon: '-91.558185', lat: '38.676635'}, {lon: '-91.418637', lat: '38.709778'}, {lon: '-91.369192', lat: '38.699324'}, {lon: '-91.367482', lat: '38.209741'}, {lon: '-91.349553', lat: '38.204078'}, {lon: '-91.095765', lat: '38.204083'}, {lon: '-90.970187', lat: '38.206687'}, {lon: '-90.780185', lat: '38.204112'}, {lon: '-90.684547', lat: '38.086311'}, {lon: '-90.63998', lat: '38.076548'}, {lon: '-90.645135', lat: '37.734813'}, {lon: '-91.100017', lat: '37.740012'}, {lon: '-91.146521', lat: '37.740811'}, {lon: '-91.153345', lat: '37.69734'}, {lon: '-91.155073', lat: '37.588092'}, {lon: '-91.312458', lat: '37.592824'}, {lon: '-91.314236', lat: '37.505132'}, {lon: '-91.210984', lat: '37.501911'}, {lon: '-91.211863', lat: '37.415277'}, {lon: '-91.646626', lat: '37.422731'}, {lon: '-91.75504', lat: '37.42411'}, {lon: '-91.754795', lat: '37.598768'}, {lon: '-91.809105', lat: '37.598863'}, {lon: '-92.029258', lat: '37.602542'}, {lon: '-92.183261', lat: '37.605243'}, {lon: '-92.249463', lat: '37.604543'}, {lon: '-92.252261', lat: '37.472944'}, {lon: '-92.686671', lat: '37.481545'}, {lon: '-92.853481', lat: '37.48397'}, {lon: '-92.846281', lat: '37.721039'}, {lon: '-92.855384', lat: '37.895736'}, {lon: '-93.072447', lat: '37.902627'}, {lon: '-93.065199', lat: '38.062479'}, {lon: '-93.059073', lat: '38.185685'}, {lon: '-93.077692', lat: '38.263092'}, {lon: '-93.067291', lat: '38.529995'}, {lon: '-93.059974', lat: '38.693077'}, {lon: '-93.050453', lat: '38.928244'}, {lon: '-93.048471', lat: '38.972418'}, {lon: '-92.934569', lat: '39.064547'}, {lon: '-92.94385', lat: '39.121738'}, {lon: '-92.849224', lat: '39.226218'}, {lon: '-92.790369', lat: '39.343586'}, {lon: '-92.707367', lat: '39.321614'}, {lon: '-92.430229', lat: '39.248795'}]
                        },
                        {
                            name: "Group 9",
                            fullName: "Group 9 - St. Louis Metro",
                            color: "#DB4436",
                            zoom: 3,
                            centerPoint: {lon: "-90.23957", lat: "38.62771"},
                            points: [{lon: '-90.958536', lat: '38.870865'}, {lon: '-90.817827', lat: '38.875966'}, {lon: '-90.707557', lat: '38.902652'}, {lon: '-90.6615829068768', lat: '38.9347033077532'}, {lon: '-90.657254', lat: '38.92027'}, {lon: '-90.595354', lat: '38.87505'}, {lon: '-90.555693', lat: '38.870785'}, {lon: '-90.500117', lat: '38.910408'}, {lon: '-90.467784', lat: '38.961809'}, {lon: '-90.4509699408919', lat: '38.9613950033245'}, {lon: '-90.395816', lat: '38.960037'}, {lon: '-90.298711', lat: '38.923395'}, {lon: '-90.2765837220256', lat: '38.9193384672116'}, {lon: '-90.230336', lat: '38.91086'}, {lon: '-90.2072823011856', lat: '38.8987323228399'}, {lon: '-90.113327', lat: '38.849306'}, {lon: '-90.117707', lat: '38.805748'}, {lon: '-90.166409', lat: '38.772649'}, {lon: '-90.1665946400156', lat: '38.7724501393051'}, {lon: '-90.20991', lat: '38.72605'}, {lon: '-90.19521', lat: '38.68755'}, {lon: '-90.1815243815313', lat: '38.6603728853105'}, {lon: '-90.18111', lat: '38.65955'}, {lon: '-90.18451', lat: '38.611551'}, {lon: '-90.248913', lat: '38.544752'}, {lon: '-90.2552948876694', lat: '38.530877711821'}, {lon: '-90.260976059287', lat: '38.5185267874078'}, {lon: '-90.271314', lat: '38.496052'}, {lon: '-90.288815', lat: '38.438453'}, {lon: '-90.3402442817043', lat: '38.3870946226363'}, {lon: '-90.3429152667372', lat: '38.3844273200276'}, {lon: '-90.349743', lat: '38.377609'}, {lon: '-90.372519', lat: '38.323354'}, {lon: '-90.363926', lat: '38.236355'}, {lon: '-90.3511641450603', lat: '38.2195444570945'}, {lon: '-90.322353', lat: '38.181593'}, {lon: '-90.2527463239757', lat: '38.1277738262293'}, {lon: '-90.253076', lat: '38.115538'}, {lon: '-90.416022', lat: '38.042315'}, {lon: '-90.628192', lat: '38.007962'}, {lon: '-90.63998', lat: '38.076548'}, {lon: '-90.684547', lat: '38.086311'}, {lon: '-90.780185', lat: '38.204112'}, {lon: '-90.970187', lat: '38.206687'}, {lon: '-91.095765', lat: '38.204083'}, {lon: '-91.349553', lat: '38.204078'}, {lon: '-91.367482', lat: '38.209741'}, {lon: '-91.369192', lat: '38.699324'}, {lon: '-91.319022', lat: '38.708368'}, {lon: '-91.226547', lat: '38.621567'}, {lon: '-91.077324', lat: '38.609343'}, {lon: '-90.964461', lat: '38.547545'}, {lon: '-90.958536', lat: '38.870865'}]
                        },
                        {
                            name: "Group 10",
                            fullName: "Group 10 - Southwest Missouri",
                            color: "#0BA9CC",
                            centerPoint: {lon: "-94.00792", lat: "37.61930"},
                            points: [{lon: '-94.618102891103', lat: '37.0567963908729'}, {lon: '-94.618351', lat: '37.160211'}, {lon: '-94.6177538916066', lat: '37.338418'}, {lon: '-94.6176676047008', lat: '37.3641703270387'}, {lon: '-94.617511', lat: '37.410909'}, {lon: '-94.6178455243542', lat: '37.6535777966344'}, {lon: '-94.6178724508981', lat: '37.6731107003321'}, {lon: '-94.617885', lat: '37.682214'}, {lon: '-94.614465', lat: '37.987799'}, {lon: '-94.6141002487054', lat: '38.0370565833813'}, {lon: '-94.6139299610557', lat: '38.0600529598965'}, {lon: '-94.612614', lat: '38.237766'}, {lon: '-94.6127726289929', lat: '38.3887184827318'}, {lon: '-94.612866', lat: '38.477571'}, {lon: '-94.6128655959221', lat: '38.4776021802351'}, {lon: '-94.31217', lat: '38.471496'}, {lon: '-94.212023', lat: '38.446754'}, {lon: '-94.065713', lat: '38.447087'}, {lon: '-94.06782', lat: '38.466016'}, {lon: '-94.064317', lat: '38.56738'}, {lon: '-93.51103', lat: '38.55621'}, {lon: '-93.512743', lat: '38.512476'}, {lon: '-93.291851', lat: '38.506321'}, {lon: '-93.290454', lat: '38.535388'}, {lon: '-93.067291', lat: '38.529995'}, {lon: '-93.077692', lat: '38.263092'}, {lon: '-93.059073', lat: '38.185685'}, {lon: '-93.065199', lat: '38.062479'}, {lon: '-93.072447', lat: '37.902627'}, {lon: '-93.182648', lat: '37.904232'}, {lon: '-93.187915', lat: '37.802737'}, {lon: '-93.561399', lat: '37.812982'}, {lon: '-93.573202', lat: '37.828035'}, {lon: '-93.628404', lat: '37.829435'}, {lon: '-93.609489', lat: '37.741755'}, {lon: '-93.616033', lat: '37.572689'}, {lon: '-93.621153', lat: '37.427423'}, {lon: '-93.625844', lat: '37.282011'}, {lon: '-93.605113', lat: '37.280253'}, {lon: '-93.608899', lat: '37.098153'}, {lon: '-93.610126', lat: '36.99581'}, {lon: '-93.337451', lat: '36.992494'}, {lon: '-93.304359', lat: '36.816866'}, {lon: '-93.3153271065291', lat: '36.4983127262979'}, {lon: '-93.426989', lat: '36.498585'}, {lon: '-93.5842815473557', lat: '36.4989016786283'}, {lon: '-93.700171', lat: '36.499135'}, {lon: '-93.8667582116711', lat: '36.4988661646849'}, {lon: '-93.95919', lat: '36.498717'}, {lon: '-94.0770882668935', lat: '36.4989759572219'}, {lon: '-94.361203', lat: '36.4996'}, {lon: '-94.617919', lat: '36.499414'}, {lon: '-94.617815', lat: '36.612604'}, {lon: '-94.6179917784172', lat: '36.6679212723442'}, {lon: '-94.618307', lat: '36.76656'}, {lon: '-94.617964', lat: '36.998905'}, {lon: '-94.618102891103', lat: '37.0567963908729'}]
                        },
                        {
                            name: "Group 11",
                            fullName: "Group 11 - S/B Metros",
                            color: "#3F5BA9",
                            zoom: 3,
                            centerPoint: {lon: "-93.21852", lat: "36.64325"},
                            points: [{lon: '-93.182648', lat: '37.904232'}, {lon: '-93.072447', lat: '37.902627'}, {lon: '-92.855384', lat: '37.895736'}, {lon: '-92.846281', lat: '37.721039'}, {lon: '-92.853481', lat: '37.48397'}, {lon: '-92.686671', lat: '37.481545'}, {lon: '-92.685867', lat: '37.067051'}, {lon: '-92.82467', lat: '37.068674'}, {lon: '-92.903273', lat: '37.070651'}, {lon: '-92.909336', lat: '36.809178'}, {lon: '-92.764869', lat: '36.806097'}, {lon: '-92.7723338933721', lat: '36.4980831540794'}, {lon: '-92.838876', lat: '36.498033'}, {lon: '-92.8540491149849', lat: '36.4980233811416'}, {lon: '-93.125969', lat: '36.497851'}, {lon: '-93.293447355634', lat: '36.4982593752343'}, {lon: '-93.3153271065291', lat: '36.4983127262979'}, {lon: '-93.304359', lat: '36.816866'}, {lon: '-93.337451', lat: '36.992494'}, {lon: '-93.610126', lat: '36.99581'}, {lon: '-93.608899', lat: '37.098153'}, {lon: '-93.605113', lat: '37.280253'}, {lon: '-93.625844', lat: '37.282011'}, {lon: '-93.621153', lat: '37.427423'}, {lon: '-93.616033', lat: '37.572689'}, {lon: '-93.609489', lat: '37.741755'}, {lon: '-93.628404', lat: '37.829435'}, {lon: '-93.573202', lat: '37.828035'}, {lon: '-93.561399', lat: '37.812982'}, {lon: '-93.187915', lat: '37.802737'}, {lon: '-93.182648', lat: '37.904232'}]
                        },
       					 {
                            name: "Group 12",
                            fullName: "Group 12 - Southeast Missouri",
                            color: "#795046",
                            points: [{lon: '-89.5017910494998', lat: '37.5588957193232'}, {lon: '-89.5124', lat: '37.52981'}, {lon: '-89.471201', lat: '37.466473'}, {lon: '-89.42594', lat: '37.407471'}, {lon: '-89.428185', lat: '37.356158'}, {lon: '-89.4736794345412', lat: '37.3348539021946'}, {lon: '-89.49516', lat: '37.324795'}, {lon: '-89.517032', lat: '37.28192'}, {lon: '-89.482889284644', lat: '37.2609507184141'}, {lon: '-89.470525', lat: '37.253357'}, {lon: '-89.456105', lat: '37.18812'}, {lon: '-89.384175', lat: '37.103267'}, {lon: '-89.359456', lat: '37.042606'}, {lon: '-89.307436691173', lat: '37.0287594496279'}, {lon: '-89.375064', lat: '36.964947'}, {lon: '-89.465393', lat: '36.935729'}, {lon: '-89.501683', lat: '36.906262'}, {lon: '-89.519809', lat: '36.869617'}, {lon: '-89.519701', lat: '36.847896'}, {lon: '-89.373741', lat: '36.702948'}, {lon: '-89.327319777009', lat: '36.6239462887705'}, {lon: '-89.378694', lat: '36.622292'}, {lon: '-89.407906', lat: '36.562345'}, {lon: '-89.479346', lat: '36.566253'}, {lon: '-89.544434', lat: '36.57451'}, {lon: '-89.571481', lat: '36.538087'}, {lon: '-89.539232', lat: '36.497934'}, {lon: '-89.521021', lat: '36.461934'}, {lon: '-89.542337', lat: '36.420103'}, {lon: '-89.51038', lat: '36.378356'}, {lon: '-89.522695', lat: '36.344789'}, {lon: '-89.5450313339691', lat: '36.344271398663'}, {lon: '-89.600544', lat: '36.342985'}, {lon: '-89.611819', lat: '36.309088'}, {lon: '-89.554289', lat: '36.277751'}, {lon: '-89.602374', lat: '36.238106'}, {lon: '-89.678046', lat: '36.248284'}, {lon: '-89.69263', lat: '36.224959'}, {lon: '-89.6276414416754', lat: '36.185460316606'}, {lon: '-89.623804', lat: '36.183128'}, {lon: '-89.592102', lat: '36.135637'}, {lon: '-89.64302', lat: '36.10362'}, {lon: '-89.680029', lat: '36.082494'}, {lon: '-89.692437', lat: '36.020507'}, {lon: '-89.733095', lat: '36.000608'}, {lon: '-89.901183', lat: '35.999365'}, {lon: '-89.9593752951737', lat: '35.9990141101569'}, {lon: '-90.103842', lat: '35.998143'}, {lon: '-90.2889479152728', lat: '35.9965140042114'}, {lon: '-90.368718', lat: '35.995812'}, {lon: '-90.339343', lat: '36.047112'}, {lon: '-90.294492', lat: '36.112949'}, {lon: '-90.235585', lat: '36.139474'}, {lon: '-90.220425', lat: '36.184764'}, {lon: '-90.1891279822169', lat: '36.1989866086674'}, {lon: '-90.155928', lat: '36.214074'}, {lon: '-90.114922', lat: '36.265595'}, {lon: '-90.06398', lat: '36.303038'}, {lon: '-90.063526', lat: '36.356911'}, {lon: '-90.066136', lat: '36.386272'}, {lon: '-90.131038', lat: '36.415069'}, {lon: '-90.141399', lat: '36.459874'}, {lon: '-90.153871', lat: '36.495344'}, {lon: '-90.2207490539154', lat: '36.4959375921945'}, {lon: '-90.494575', lat: '36.498368'}, {lon: '-90.5761790655673', lat: '36.498405927798'}, {lon: '-90.765672', lat: '36.498494'}, {lon: '-90.7842441551312', lat: '36.4984622001291'}, {lon: '-91.017974', lat: '36.498062'}, {lon: '-91.1265388745647', lat: '36.4977977010194'}, {lon: '-91.404915', lat: '36.49712'}, {lon: '-91.4071374435175', lat: '36.4971407119486'}, {lon: '-91.4500049181374', lat: '36.4975402131847'}, {lon: '-91.64259', lat: '36.499335'}, {lon: '-91.6723424564437', lat: '36.4992566337989'}, {lon: '-91.985802', lat: '36.498431'}, {lon: '-92.1204291043881', lat: '36.4981931239997'}, {lon: '-92.1503062495012', lat: '36.4981403333242'}, {lon: '-92.350277', lat: '36.497787'}, {lon: '-92.5291365810437', lat: '36.4981656829853'}, {lon: '-92.564238', lat: '36.49824'}, {lon: '-92.7723338933721', lat: '36.4980831540794'}, {lon: '-92.764869', lat: '36.806097'}, {lon: '-92.909336', lat: '36.809178'}, {lon: '-92.903273', lat: '37.070651'}, {lon: '-92.82467', lat: '37.068674'}, {lon: '-92.685867', lat: '37.067051'}, {lon: '-92.686671', lat: '37.481545'}, {lon: '-92.252261', lat: '37.472944'}, {lon: '-92.249463', lat: '37.604543'}, {lon: '-92.183261', lat: '37.605243'}, {lon: '-92.029258', lat: '37.602542'}, {lon: '-91.809105', lat: '37.598863'}, {lon: '-91.754795', lat: '37.598768'}, {lon: '-91.75504', lat: '37.42411'}, {lon: '-91.646626', lat: '37.422731'}, {lon: '-91.211863', lat: '37.415277'}, {lon: '-91.210984', lat: '37.501911'}, {lon: '-91.314236', lat: '37.505132'}, {lon: '-91.312458', lat: '37.592824'}, {lon: '-91.155073', lat: '37.588092'}, {lon: '-91.153345', lat: '37.69734'}, {lon: '-91.146521', lat: '37.740811'}, {lon: '-91.100017', lat: '37.740012'}, {lon: '-90.645135', lat: '37.734813'}, {lon: '-90.63998', lat: '38.076548'}, {lon: '-90.628192', lat: '38.007962'}, {lon: '-90.416022', lat: '38.042315'}, {lon: '-90.253076', lat: '38.115538'}, {lon: '-90.2527463239757', lat: '38.1277738262293'}, {lon: '-90.252484', lat: '38.127571'}, {lon: '-90.218708', lat: '38.094365'}, {lon: '-90.2057286258827', lat: '38.0882331831086'}, {lon: '-90.126006', lat: '38.05057'}, {lon: '-90.080959', lat: '38.015428'}, {lon: '-90.008353', lat: '37.970179'}, {lon: '-89.95491', lat: '37.966647'}, {lon: '-89.974221', lat: '37.919217'}, {lon: '-89.933095790915', lat: '37.8800990582524'}, {lon: '-89.923185', lat: '37.870672'}, {lon: '-89.851048', lat: '37.90398'}, {lon: '-89.782035', lat: '37.855092'}, {lon: '-89.696559', lat: '37.814337'}, {lon: '-89.6872213808531', lat: '37.7964067184393'}, {lon: '-89.667993', lat: '37.759484'}, {lon: '-89.591289', lat: '37.723599'}, {lon: '-89.521948', lat: '37.696475'}, {lon: '-89.506563', lat: '37.62505'}, {lon: '-89.494051', lat: '37.580116'}, {lon: '-89.4977459260392', lat: '37.5699859139282'}, {lon: '-89.5017910494998', lat: '37.5588957193232'}]
                        }];

    groupsData.forEach(function(groupData) {
    	addRaidPolygon(mapLayer, groupData);
    });

    W.map.addLayer(mapLayer);
    mapLayer.setVisibility(localStorage.MapRaidKSMOVisible == "true");

    createLayerToggler(document.getElementById('layer-switcher-group_display').parentNode.parentNode, localStorage.MapRaidKSMOVisible == "true", localStorage.MapRaidKSMOFill == "true", mapRaidName, function(checked) {
        localStorage.MapRaidKSMOVisible = checked;
        var fillCheckBox = document.getElementById('layer-switcher-group_' + mapRaidName.toLowerCase().replace(/\s/g, '') + '_fill');
        if (fillCheckBox) fillCheckBox.disabled = !checked;
        var areaJumper = document.getElementById(mapraidId + "Dropdown");
        areaJumper.style.width = (checked ? "80%" : 0);
        areaJumper.style.visibility = (checked ? "" : "hidden");
        if (areaJumper.parentNode) {
            areaJumper.parentNode.style.flexGrow = (checked ? "1" : "");
        }
        mapLayer.setVisibility(checked);
        displayCurrentRaidLocation();
    }, function(checked) {
        localStorage.MapRaidKSMOFill = checked;
        console.log(mapLayer.features);
        var newFeatures = [];
        mapLayer.features.forEach(function(feature) {
            var newFeature = feature.clone();
            newFeature.style.fillOpacity = (checked ? overlayColorFill : 0);
            newFeatures.push(newFeature);
        });
        mapLayer.destroyFeatures();
        mapLayer.addFeatures(newFeatures);
        displayCurrentRaidLocation();
    });

    var areaJumper = document.getElementById(mapraidId + "Dropdown");
    if (!areaJumper) {
        areaJumper = document.createElement('select');
        areaJumper.id = mapraidId + "Dropdown";
        areaJumper.style.marginTop = '4px';
        areaJumper.style.display = 'block';
        var areaPlaceholder = document.createElement('option');
        areaPlaceholder.textContent = 'Jump to..';
        areaJumper.appendChild(areaPlaceholder);
        areaJumper.addEventListener('change', function() {
            W.map.setCenter(areaJumper.selectedOptions[0].centroid);
            if (areaJumper.selectedOptions[0].zoom != -1) W.map.zoomTo(areaJumper.selectedOptions[0].zoom);
            areaJumper.selectedIndex = 0;
            areaJumper.blur();
        });
    }
	var areaJumperRegion = document.createElement('optgroup');
	areaJumperRegion.label = mapRaidName + " Regions:";
	mapLayer.features.forEach(function(feature) {
		var area = document.createElement('option');
		area.textContent = feature.attributes.name;
		area.centroid = [feature.attributes.centerPoint.x, feature.attributes.centerPoint.y];
		area.zoom = feature.attributes.zoom;
		areaJumperRegion.appendChild(area);
	});
	areaJumper.appendChild(areaJumperRegion);

	if (!document.getElementById(mapraidId + "Dropdown")) {
		if (window.getComputedStyle(document.getElementById('edit-buttons').parentNode).display == 'flex') {
			var areaJumperContainer = document.createElement('div');
			areaJumperContainer.style.flexGrow = (localStorage.MapRaidKSMOVisible == "true" ? "1" : "");
			areaJumperContainer.style.paddingTop = '6px';
			areaJumper.style.width = (localStorage.MapRaidKSMOVisible == "true" ? "80%" : 0);
			areaJumper.style.visibility = (localStorage.MapRaidKSMOVisible == "true" ? "" : "hidden");
			areaJumper.style.margin = '0 auto';
			areaJumperContainer.appendChild(areaJumper);
			document.getElementById('edit-buttons').parentNode.insertBefore(areaJumperContainer, document.getElementById('edit-buttons'));
		} else {
			document.getElementById('edit-buttons').parentNode.insertBefore(areaJumper, document.getElementById('edit-buttons'));
		}
	}

    displayCurrentRaidLocation();
    W.map.events.register("moveend", null, displayCurrentRaidLocation);
}