<?php
if (isset($_POST["time"])) {
	include('getId.php');
	include('session.php');
	include('initdb.php');
    $time = intval($_POST["time"]);
    if (!$id) $id = 0;
    mysql_query('INSERT INTO mkgametime SET player="'.$id.'",identifiant="'.$identifiants[0].'",time="'.$time.'" ON DUPLICATE KEY UPDATE time=time+VALUES(time)');
    mysql_close();
    echo 1;
}
?>