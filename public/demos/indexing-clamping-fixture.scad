/*
Overflow Partner / OP-DEMO-001 / Revision D00
Fictional design study: pneumatic indexing and clamping fixture
Units: millimetres. Concept geometry only. NOT an approved engineering design.
Design validation, fasteners, tolerances, pneumatic forces and safety pending review.
*/
$fn=64;
module base_plate(){difference(){translate([-160,-120,0])cube([320,240,18]);for(x=[-136,136],y=[-96,96])translate([x,y,-1])cylinder(h=20,d=12);}}
module table(){difference(){translate([0,0,48])cylinder(h=14,d=160);translate([0,0,47])cylinder(h=16,d=24);/* additional indexing/locking holes TBD after independent review */}}
module pedestal(){translate([0,0,18])cylinder(h=30,d=56);}
module guide(x){translate([x,-47,18])cube([24,94,42]);}
module clamp_jaw(x){translate([x,-25,60])cube([34,50,28]);}
module actuator_block(x){translate([x,-38,18])cube([52,76,40]);}
color([0.35,0.43,0.41])base_plate();
color([0.75,0.79,0.77])pedestal();
color([0.80,0.85,0.81])table();
color([0.35,0.43,0.41])guide(-126);
color([0.35,0.43,0.41])guide(102);
color([0.89,0.42,0.18])clamp_jaw(-107);
color([0.89,0.42,0.18])clamp_jaw(73);
color([0.63,0.72,0.67])actuator_block(-151);
color([0.63,0.72,0.67])actuator_block(99);
