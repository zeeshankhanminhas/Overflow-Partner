/*
Overflow Partner / OP-DEMO-002 / Revision D00
Fictional study: adjustable conveyor roller support
Units: millimetres. Concept geometry only, pending independent review.
Clearance, fits, deflection, bearing and fastening specs are intentionally TBD.
*/
$fn=72;
module base(){difference(){translate([-155,-90,0])cube([310,180,12]);for(x=[-135,135],y=[-70,70])translate([x,y,-1])cylinder(h=14,d=11);}}
module upright(x){difference(){translate([x,-12,12])cube([18,24,150]);translate([x-1,0,133])rotate([0,90,0])cylinder(h=20,d=17);}}
module roller(){translate([-110,0,133])rotate([0,90,0])difference(){cylinder(h=220,d=54);translate([0,0,-1])cylinder(h=222,d=16);}}
module shaft(){translate([-130,0,133])rotate([0,90,0])cylinder(h=260,d=16);}
module foot(x){translate([x,-32,12])cube([35,64,12]);}
color([.42,.51,.47])base();
color([.65,.72,.68])upright(-130);
color([.65,.72,.68])upright(112);
// Adjustable feet remain a concept option, not in STEP D00.

color([.81,.85,.83])roller();
color([.22,.29,.27])shaft();
