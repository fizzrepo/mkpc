<?php
$data = json_decode(file_get_contents('php://input'));
if (is_object($data) && isset($data->id) && isset($data->payload)) {
	$id = $data->id;
	$payload = $data->payload;
	include('initdb.php');
	include('getId.php');
	require_once('collabUtils.php');
	$requireOwner = !hasCollabGrants('arenes', $data->id, $data->collab, 'edit');
	if ($getCircuit = mysql_fetch_array(mysql_query('SELECT publication_date FROM arenes WHERE id="'.mysql_real_escape_string($id).'"'. ($requireOwner ? (' AND identifiant='.$identifiants[0].' AND identifiant2='.$identifiants[1].' AND identifiant3='.$identifiants[2].' AND identifiant4='.$identifiants[3]) : ''))))
		mysql_query('INSERT INTO arenes_data VALUES("'.mysql_real_escape_string($id).'","'.mysql_real_escape_string(gzcompress(json_encode($payload))).'") ON DUPLICATE KEY UPDATE data=VALUES(data)');
	echo 1;
	mysql_close();
	include('cache_creations.php');
	@unlink(cachePath("coursepreview$id.png"));
}
?>